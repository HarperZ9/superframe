@rem Run from a Developer Command Prompt for Visual Studio, with dxc on the PATH (the Windows SDK or the Vulkan SDK ships it).
dxc -T cs_6_5 -E main -Fo cs.cso cs.hlsl
dxc -T cs_6_5 -E main -Fo sweep.cso sweep.hlsl
cl /nologo /EHsc /O2 repro.cpp
