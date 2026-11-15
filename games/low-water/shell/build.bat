@echo off
rem Builds shell\out\lwhost.exe. Needs MSVC (the VS 2022 or later x64 tools), a QuickJS-ng checkout and raw-native.
rem   build.bat QUICKJS_DIR [RAW_NATIVE_DIR]
setlocal
set QJS=%~1
if "%QJS%"=="" (echo usage: build.bat QUICKJS_DIR [RAW_NATIVE_DIR] & exit /b 64)
set RN=%~2
if "%RN%"=="" set RN=%~dp0..\..\..\native
set HERE=%~dp0
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
set OUT=%HERE%out
set OBJ=%HERE%out\obj
if not exist "%OUT%" mkdir "%OUT%"
if not exist "%OBJ%" mkdir "%OBJ%"
cl /nologo /O2 /GL /MT /std:c11 /experimental:c11atomics /W0 /DNDEBUG /D_CRT_SECURE_NO_WARNINGS /DWIN32_LEAN_AND_MEAN /Fo"%OBJ%\\" /I"%QJS%" /c /Tc"%QJS%\quickjs.c" /Tc"%QJS%\cutils.c" /Tc"%QJS%\libregexp.c" /Tc"%QJS%\libunicode.c" /Tc"%QJS%\xsum.c" || exit /b 1
cl /nologo /O2 /GL /MT /std:c++20 /EHsc /W3 /DNDEBUG /D_CRT_SECURE_NO_WARNINGS /DNOMINMAX /D_SILENCE_ALL_CXX20_DEPRECATION_WARNINGS /I"%QJS%" /I"%RN%" /Fo"%OBJ%\\" /Fe"%OUT%\lwhost.exe" "%HERE%host\lwhost.cpp" "%RN%\src\platform\win32\file_bridge_win32.cpp" "%OBJ%\quickjs.obj" "%OBJ%\cutils.obj" "%OBJ%\libregexp.obj" "%OBJ%\libunicode.obj" "%OBJ%\xsum.obj" /link /LTCG user32.lib gdi32.lib ole32.lib windowscodecs.lib psapi.lib uuid.lib || exit /b 2
copy /y "%HERE%host\shim.js" "%OUT%\shim.js" >nul
echo built %OUT%\lwhost.exe
