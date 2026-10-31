@echo off
rem Runs the kernel library CLI. Set KERNELS_PY to the interpreter of a PyTorch-with-CUDA
rem environment for the GPU checks; the default is python on PATH (CPU only).
if not defined KERNELS_PY set "KERNELS_PY=python"
"%KERNELS_PY%" -B "%~dp0kernels.py" %*
