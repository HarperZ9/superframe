@echo off
rem Runs the kernel library CLI. Set KERNELS_PY to choose the interpreter; the default
rem is python on PATH (CPU only); point KERNELS_PY at a PyTorch CUDA venv for the GPU path.
if not defined KERNELS_PY set "KERNELS_PY=python"
"%KERNELS_PY%" -B "%~dp0kernels.py" %*
