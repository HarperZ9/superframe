/* driver.c: link the BuildLang light-response kernel and run it on a real table.
   driver TABLE.bin OFFSET_FLOATS SIDE [COUNT] < albedos (r g b per line) > reflected (r g b per line, %.17g)
   COUNT is the number of floats passed to the kernel; it defaults to SIDE^3 * 3. A smaller COUNT is the control:
   the kernel's reads are checked against it, so a lookup that needs a float past COUNT traps. */
#include <stdio.h>
#include <stdlib.h>
#include "main.h"

int main(int argc, char **argv) {
    if (argc < 4) { fprintf(stderr, "usage: driver TABLE.bin OFFSET_FLOATS SIDE [COUNT]\n"); return 2; }
    FILE *f = fopen(argv[1], "rb");
    if (!f) { perror(argv[1]); return 1; }
    long off = atol(argv[2]);
    size_t side = (size_t)atol(argv[3]), size = side * side * side * 3;
    size_t count = argc > 4 ? (size_t)atol(argv[4]) : size;
    float *t = (float *)malloc(size * sizeof(float));
    if (fseek(f, off * 4L, SEEK_SET) != 0 || fread(t, sizeof(float), size, f) != size) { fprintf(stderr, "short read\n"); return 1; }
    fclose(f);
    double r, g, b;
    while (scanf("%lf %lf %lf", &r, &g, &b) == 3) {
        Rgb o = lw_light_reflect(t, count, side, r, g, b);
        printf("%.17g %.17g %.17g\n", o.r, o.g, o.b);
    }
    free(t);
    return 0;
}
