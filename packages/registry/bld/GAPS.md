# Compiler gaps met while writing the checker

## A local named `argc` or `argv` in `main` breaks the C build

buildc 1.14.0 emits `main` as `int32_t main(int argc, char** argv)` and declares BuildLang locals under their own names, so a local called `argc` or `argv` inside `main` redeclares the C parameter and the C compiler rejects the file.

```
fn main() ~ Console + Environment {
    let argc: i32 = args_count() as i32;
    println("{}", argc);
}
```

`buildc run` on this program stops with `error: 'argc' redeclared as different kind of symbol` from the C compiler. The same happens with `let argv`. The checker names its local `nargs` instead. The fix belongs in the C backend: mangle locals, or name the C parameters something a BuildLang program cannot spell.

Seen with buildc 1.14.0. Not yet tried on 1.10.0, the version CI pins.
