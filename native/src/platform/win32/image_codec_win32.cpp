// See raw/platform/image_codec.hpp. Windows Imaging Component, COM on the calling thread.
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <wincodec.h>
#include "raw/platform/image_codec.hpp"
#include <cstdio>
#include <utility>
namespace raw::platform {
namespace {
template<class T> struct Com {
    T* p{nullptr};
    ~Com(){ if (p) p->Release(); }
    T** put(){ return &p; }
    T* operator->(){ return p; }
};
std::wstring wide(const std::string& s){
    const int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
    std::wstring w(n > 0 ? n - 1 : 0, L'\0');
    if (n > 1) MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, w.data(), n);
    return w;
}
bool hr(HRESULT h, const char* what, const std::string& path, std::string& err){
    if (SUCCEEDED(h)) return true;
    char b[32]; std::snprintf(b, sizeof b, "0x%08lx", (unsigned long)h);
    err = std::string("image: ") + what + " " + path + " failed (" + b + ")";
    return false;
}
// COM for this thread, once; a thread already in another apartment keeps it (RPC_E_CHANGED_MODE).
bool comInit(std::string& err){
    static thread_local bool done = false;
    if (done) return true;
    const HRESULT h = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(h) && h != RPC_E_CHANGED_MODE) return hr(h, "CoInitializeEx", "", err);
    done = true;
    return true;
}
bool factory(Com<IWICImagingFactory>& f, std::string& err){
    return comInit(err) && hr(CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(f.put())),
                              "WIC factory", "", err);
}
}  // namespace

bool decodeImage(const std::string& path, Image16& out, std::string& err){
    Com<IWICImagingFactory> f;
    if (!factory(f, err)) return false;
    Com<IWICBitmapDecoder> dec;
    Com<IWICBitmapFrameDecode> frame;
    Com<IWICFormatConverter> conv;
    const std::wstring w = wide(path);
    if (!hr(f->CreateDecoderFromFilename(w.c_str(), nullptr, GENERIC_READ, WICDecodeMetadataCacheOnDemand, dec.put()), "open", path, err) ||
        !hr(dec->GetFrame(0, frame.put()), "frame", path, err) || !hr(f->CreateFormatConverter(conv.put()), "converter", path, err) ||
        !hr(conv->Initialize(frame.p, GUID_WICPixelFormat64bppRGBA, WICBitmapDitherTypeNone, nullptr, 0.0, WICBitmapPaletteTypeCustom),
            "convert", path, err)) return false;
    UINT wd = 0, ht = 0;
    if (!hr(conv->GetSize(&wd, &ht), "size", path, err)) return false;
    if (wd == 0 || ht == 0 || wd > 16384 || ht > 16384){ err = "image: " + path + " has an unsupported size"; return false; }
    out.width = wd; out.height = ht;
    out.rgba.assign(size_t(wd) * ht * 4, 0);
    return hr(conv->CopyPixels(nullptr, wd * 8, UINT(out.rgba.size() * 2), reinterpret_cast<BYTE*>(out.rgba.data())), "read", path, err);
}

bool encodePng(const std::string& path, uint32_t width, uint32_t height, const std::vector<uint8_t>& rgba, std::string& err){
    if (rgba.size() < size_t(width) * height * 4){ err = "image: too few pixels for " + path; return false; }
    Com<IWICImagingFactory> f;
    if (!factory(f, err)) return false;
    Com<IWICStream> st;
    Com<IWICBitmapEncoder> enc;
    Com<IWICBitmapFrameEncode> frame;
    const std::wstring w = wide(path);
    if (!hr(f->CreateStream(st.put()), "stream", path, err) || !hr(st->InitializeFromFilename(w.c_str(), GENERIC_WRITE), "create", path, err) ||
        !hr(f->CreateEncoder(GUID_ContainerFormatPng, nullptr, enc.put()), "encoder", path, err) ||
        !hr(enc->Initialize(st.p, WICBitmapEncoderNoCache), "encoder init", path, err) ||
        !hr(enc->CreateNewFrame(frame.put(), nullptr), "frame", path, err) || !hr(frame->Initialize(nullptr), "frame init", path, err) ||
        !hr(frame->SetSize(width, height), "frame size", path, err)) return false;
    // the PNG encoder takes BGRA: swap red and blue into a copy
    WICPixelFormatGUID fmt = GUID_WICPixelFormat32bppBGRA;
    if (!hr(frame->SetPixelFormat(&fmt), "pixel format", path, err)) return false;
    if (fmt != GUID_WICPixelFormat32bppBGRA){ err = "image: the PNG encoder refused 32-bit BGRA for " + path; return false; }
    std::vector<uint8_t> bgra(rgba.begin(), rgba.begin() + size_t(width) * height * 4);
    for (size_t p = 0; p < bgra.size(); p += 4) std::swap(bgra[p], bgra[p + 2]);
    return hr(frame->WritePixels(height, width * 4, UINT(bgra.size()), bgra.data()), "write", path, err) &&
           hr(frame->Commit(), "commit frame", path, err) && hr(enc->Commit(), "commit", path, err);
}

}  // namespace raw::platform
