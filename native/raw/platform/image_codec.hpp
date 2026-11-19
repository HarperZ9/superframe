#pragma once
// Image files through the operating system's codecs (Windows Imaging Component on Windows).
// decode: PNG, JPEG, TIFF, BMP and the rest WIC knows, 8 or 16 bits a channel, to 16-bit RGBA
//   (8-bit sources are widened by v * 257, so no information is lost and one path serves both).
// encodePng: 8-bit RGBA to a PNG file.
// On other platforms both return false with an error saying so.
#include <cstdint>
#include <string>
#include <vector>
namespace raw::platform {

struct Image16 {
    uint32_t width{0}, height{0};
    std::vector<uint16_t> rgba;   // width * height * 4
};
bool decodeImage(const std::string& path, Image16& out, std::string& err);
bool encodePng(const std::string& path, uint32_t width, uint32_t height, const std::vector<uint8_t>& rgba, std::string& err);

}  // namespace raw::platform
