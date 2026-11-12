# SPDX-License-Identifier: FSL-1.1-MIT
# Builds the C++ vector runner. Usage:
#   cmake -S tests -B build && cmake --build build --config Release
#   build/run_vectors <repo root>     (build/Release/run_vectors.exe with MSVC)
#   Emscripten: emcmake cmake -S tests -B build-wasm && cmake --build build-wasm
#   node build-wasm/run_vectors.js <repo root>
cmake_minimum_required(VERSION 3.20)
project(superstack_tests CXX)
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(SUPERSTACK_INCLUDE "${CMAKE_CURRENT_SOURCE_DIR}/.." CACHE PATH "Directory holding superstack.hpp")
add_executable(run_vectors run_vectors.cpp)
target_include_directories(run_vectors PRIVATE "${SUPERSTACK_INCLUDE}")
if(EMSCRIPTEN)
  # Node runs the output; NODERAWFS lets it read vectors/ from the real disk.
  target_compile_options(run_vectors PRIVATE -fexceptions)
  target_link_options(run_vectors PRIVATE -fexceptions -sNODERAWFS=1 -sALLOW_MEMORY_GROWTH=1)
endif()
if(MSVC)
  target_compile_options(run_vectors PRIVATE /W4 /WX /permissive- /utf-8 /EHsc)
else()
  target_compile_options(run_vectors PRIVATE -Wall -Wextra -Wpedantic -Werror)
endif()
