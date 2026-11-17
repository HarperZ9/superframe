# The AO comparison (bench/ao/README.md). Off by default; nothing here is part of the library.
#   RAW_NATIVE_AO_BENCH=ON   ao_export: the five scenes' view G-buffers and ray-cast AO reference.
#                            On Windows with MSVC also ao_bench: our GTAO and XeGTAO
#                            (third_party/xegtao, MIT) on D3D12, scored and timed, with the
#                            shaders compiled by dxc into <build>/ao_cso/.
option(RAW_NATIVE_AO_BENCH "Build the AO comparison tools (bench/ao/)" OFF)
if(NOT RAW_NATIVE_AO_BENCH)
    return()
endif()

add_executable(ao_export bench/ao/ao_export.cpp bench/ao/ao_scenes.cpp ${RAW_NATIVE_NULL_BACKEND})
target_link_libraries(ao_export PRIVATE raw_native)

if(NOT (WIN32 AND MSVC))
    message(STATUS "raw-native: ao_bench needs Windows and MSVC; building ao_export only")
    return()
endif()
if(NOT RAW_NATIVE_DXC)
    raw_native_find_dxc()
endif()
set(ao_cso "${CMAKE_CURRENT_BINARY_DIR}/ao_cso")
set(ao_outputs "")
# Ours: the engine's GTAO pass with the engine's own dxc flags (cmake/gpu.cmake).
add_custom_command(OUTPUT "${ao_cso}/post_gtao.cso"
    COMMAND "${CMAKE_COMMAND}" -E make_directory "${ao_cso}"
    COMMAND "${RAW_NATIVE_DXC}" -T cs_6_0 -E main -HV 2021 -Gis -O3 -Fo "${ao_cso}/post_gtao.cso"
            "${CMAKE_CURRENT_SOURCE_DIR}/src/renderer/gpu/shaders/hlsl/post_gtao.hlsl"
    DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/src/renderer/gpu/shaders/hlsl/post_gtao.hlsl" VERBATIM)
list(APPEND ao_outputs "${ao_cso}/post_gtao.cso")
# Ours, fast: three passes of one file (bench/ao/shaders/ours_gtao_fast.hlsl).
set(fast_src "${CMAKE_CURRENT_SOURCE_DIR}/bench/ao/shaders/ours_gtao_fast.hlsl")
foreach(e CSPack CSMain CSBlur)
    add_custom_command(OUTPUT "${ao_cso}/fast_${e}.cso"
        COMMAND "${CMAKE_COMMAND}" -E make_directory "${ao_cso}"
        COMMAND "${RAW_NATIVE_DXC}" -T cs_6_0 -E ${e} -HV 2021 -O3 -Fo "${ao_cso}/fast_${e}.cso" "${fast_src}"
        DEPENDS "${fast_src}" VERBATIM)
    list(APPEND ao_outputs "${ao_cso}/fast_${e}.cso")
endforeach()
# XeGTAO: each entry point twice, with its shipped constants (xe1_) and with settable ones (xe0_).
set(xe_src "${CMAKE_CURRENT_SOURCE_DIR}/bench/ao/shaders/xegtao_bench.hlsl")
foreach(e CSPrefilterDepths16x16 CSGTAOLow CSGTAOMedium CSGTAOHigh CSGTAOUltra CSDenoiseLastPass)
    foreach(d 0 1)
        add_custom_command(OUTPUT "${ao_cso}/xe${d}_${e}.cso"
            COMMAND "${CMAKE_COMMAND}" -E make_directory "${ao_cso}"
            COMMAND "${RAW_NATIVE_DXC}" -T cs_6_0 -E ${e} -HV 2021 -O3 -DXE_GTAO_USE_DEFAULT_CONSTANTS=${d}
                    -I "${CMAKE_CURRENT_SOURCE_DIR}/third_party/xegtao" -Fo "${ao_cso}/xe${d}_${e}.cso" "${xe_src}"
            DEPENDS "${xe_src}" "${CMAKE_CURRENT_SOURCE_DIR}/third_party/xegtao/XeGTAO.hlsli"
                    "${CMAKE_CURRENT_SOURCE_DIR}/third_party/xegtao/XeGTAO.h" VERBATIM)
        list(APPEND ao_outputs "${ao_cso}/xe${d}_${e}.cso")
    endforeach()
endforeach()
add_custom_target(ao_bench_shaders ALL DEPENDS ${ao_outputs})
add_executable(ao_bench bench/ao/ao_bench.cpp bench/ao/ao_gpu_ours.cpp bench/ao/ao_gpu_xe.cpp bench/ao/dx.cpp bench/ao/ao_score.cpp)
target_compile_features(ao_bench PRIVATE cxx_std_23)
target_link_libraries(ao_bench PRIVATE d3d12 dxgi)
add_dependencies(ao_bench ao_bench_shaders)
