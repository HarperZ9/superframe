/* driver.c: link the BuildLang light-response kernel and run it on the real table.
   driver TABLE.bin OFFSET_FLOATS < albedos (r g b per line) > reflected (r g b per line, %.17g) */
#include <stdio.h>
#include <stdlib.h>
#include "main.h"

int main(int argc, char **argv) {
    if (argc < 3) { fprintf(stderr, "usage: driver TABLE.bin OFFSET_FLOATS\n"); return 2; }
    FILE *f = fopen(argv[1], "rb");
    if (!f) { perror(argv[1]); return 1; }
    long off = atol(argv[2]);
    Table17 *t = (Table17 *)malloc(sizeof(Table17));
    if (fseek(f, off * 4L, SEEK_SET) != 0 || fread(t->v, sizeof(float), 14739, f) != 14739) { fprintf(stderr, "short read\n"); return 1; }
    fclose(f);
    double r, g, b;
    while (scanf("%lf %lf %lf", &r, &g, &b) == 3) {
        Rgb o = lw_light_reflect(t, r, g, b);
        printf("%.17g %.17g %.17g\n", o.r, o.g, o.b);
    }
    free(t);
    return 0;
}
