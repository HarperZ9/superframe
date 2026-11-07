# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""CUDA C for the lean GPU engine (lean.py). Particles are stored as six float32 arrays (x, y, z, px, py, pz)
so no step needs an (N, 3) temporary. Every sum is either integer (the deposit) or done by one thread in a
fixed order (readback, pair force), so runs repeat bit for bit."""

DEPOSIT = r"""
extern "C" __global__ void cic_deposit_slab(const float* __restrict__ x, const float* __restrict__ y,
    const float* __restrict__ z, int n, int ng, float cell, float q, int x0, int nx, float shift,
    unsigned long long* __restrict__ out)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;
    // shift (in cells) moves every particle before assignment; 0 for forces, 0.5 for an interlaced P(k)
    float gx = x[i] / cell + shift, gy = y[i] / cell + shift, gz = z[i] / cell + shift;
    float fx = floorf(gx), fy = floorf(gy), fz = floorf(gz);
    float d[3] = {gx - fx, gy - fy, gz - fz};
    int c0[3] = {((int)fx % ng + ng) % ng, ((int)fy % ng + ng) % ng, ((int)fz % ng + ng) % ng};
    for (int cx = 0; cx < 2; ++cx) {
        int ix = (c0[0] + cx) % ng - x0;
        if (ix < 0 || ix >= nx) continue;
        float wx = cx ? d[0] : 1.f - d[0];
        for (int cy = 0; cy < 2; ++cy) {
            int iy = (c0[1] + cy) % ng;
            float wy = cy ? d[1] : 1.f - d[1];
            for (int cz = 0; cz < 2; ++cz) {
                int iz = (c0[2] + cz) % ng;
                float w = (wx * wy) * (cz ? d[2] : 1.f - d[2]);
                long long iw = __double2ll_rn((double)w * (double)q);
                atomicAdd(&out[((long long)ix * ng + iy) * ng + iz], (unsigned long long)iw);
            }
        }
    }
}
"""

READBACK = r"""
extern "C" __global__ void cic_kick(const float* __restrict__ x, const float* __restrict__ y,
    const float* __restrict__ z, int n, int ng, float cell, const float* __restrict__ g, float k,
    float* __restrict__ p)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;
    float gx = x[i] / cell, gy = y[i] / cell, gz = z[i] / cell;
    float fx = floorf(gx), fy = floorf(gy), fz = floorf(gz);
    float d[3] = {gx - fx, gy - fy, gz - fz};
    int c0[3] = {((int)fx % ng + ng) % ng, ((int)fy % ng + ng) % ng, ((int)fz % ng + ng) % ng};
    float acc = 0.f;
    for (int cx = 0; cx < 2; ++cx) {
        int ix = (c0[0] + cx) % ng;
        float wx = cx ? d[0] : 1.f - d[0];
        for (int cy = 0; cy < 2; ++cy) {
            int iy = (c0[1] + cy) % ng;
            float wy = cy ? d[1] : 1.f - d[1];
            for (int cz = 0; cz < 2; ++cz) {
                int iz = (c0[2] + cz) % ng;
                acc += g[((long long)ix * ng + iy) * ng + iz] * ((wx * wy) * (cz ? d[2] : 1.f - d[2]));
            }
        }
    }
    p[i] += k * acc;
}
"""

PAIR = r"""
extern "C" __global__ void p3m_kick(const float* __restrict__ x, const float* __restrict__ y,
    const float* __restrict__ z, float* __restrict__ px, float* __restrict__ py, float* __restrict__ pz,
    unsigned char* __restrict__ level, const int* __restrict__ act, int use_act, int nact,
    const int* __restrict__ start, const int* __restrict__ count, int nc, int reach, float cs, float box,
    float rcut2, float inv2rs, float eps2, float gm, const float* __restrict__ kclose,
    const float* __restrict__ kopen, int thr, int lmax, float crit, int* __restrict__ nclamp)
{
    int k = blockIdx.x * blockDim.x + threadIdx.x;
    if (k >= nact) return;
    int i = use_act ? act[k] : k;
    float xi = x[i], yi = y[i], zi = z[i];
    int cx = min((int)(xi / cs), nc - 1), cy = min((int)(yi / cs), nc - 1), cz = min((int)(zi / cs), nc - 1);
    float ax = 0.f, ay = 0.f, az = 0.f, hb = 0.5f * box;
    for (int dx = -reach; dx <= reach; ++dx) {
        int ex = (cx + dx + nc) % nc;
        for (int dy = -reach; dy <= reach; ++dy) {
            int ey = (cy + dy + nc) % nc;
            for (int dz = -reach; dz <= reach; ++dz) {
                int ez = (cz + dz + nc) % nc;
                int q = (ex * nc + ey) * nc + ez;
                int j0 = start[q], j1 = j0 + count[q];
                for (int j = j0; j < j1; ++j) {
                    if (j == i) continue;
                    float ddx = xi - x[j], ddy = yi - y[j], ddz = zi - z[j];
                    ddx = ddx > hb ? ddx - box : (ddx < -hb ? ddx + box : ddx);
                    ddy = ddy > hb ? ddy - box : (ddy < -hb ? ddy + box : ddy);
                    ddz = ddz > hb ? ddz - box : (ddz < -hb ? ddz + box : ddz);
                    float r2 = ddx * ddx + ddy * ddy + ddz * ddz;
                    if (r2 >= rcut2) continue;
                    float rho2 = r2 + eps2;
                    if (rho2 <= 0.f) continue;
                    float irho = rsqrtf(rho2);
                    float u = rho2 * irho * inv2rs;
                    // erfc(u) = t P(t) exp(-u^2), t = 1 / (1 + 0.3275911 u), absolute error under 1.5e-7
                    // (Abramowitz and Stegun 7.1.26), so one exponential serves both terms
                    float t = 1.f / (1.f + 0.3275911f * u);
                    float poly = t * (0.254829592f + t * (-0.284496736f + t * (1.421413741f
                                 + t * (-1.453152027f + t * 1.061405429f))));
                    float s = (poly + 1.1283791670955126f * u) * expf(-u * u);
                    float f = gm * s * irho * irho * irho;
                    ax -= f * ddx; ay -= f * ddy; az -= f * ddz;
                }
            }
        }
    }
    float r = crit * sqrtf(ax * ax + ay * ay + az * az);
    int lv = 0;
    while (lv < lmax && (float)(1 << (2 * lv)) < r) ++lv;
    if ((float)(1 << (2 * lv)) < r) atomicAdd(nclamp, 1);
    if (lv < thr) lv = thr;
    float kk = kclose[level[i]] + kopen[lv];
    px[i] += kk * ax; py[i] += kk * ay; pz[i] += kk * az;
    level[i] = (unsigned char)lv;
}
"""
