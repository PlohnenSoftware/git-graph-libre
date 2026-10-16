//! What lets the Linux glibc build of this addon load into a musl process as well.
//!
//! The gnu build is linked against glibc 2.28 and binds every C-library import by symbol version,
//! so on glibc it behaves exactly as a gnu build always has. musl's dynamic linker ignores those
//! versions and resolves the same imports by name, and every one of them exists in musl except
//! `gnu_get_libc_version` — which the gnu-target standard library calls when it spawns a process
//! (to decide whether `posix_spawn` is safe to use). gix spawns `.gitattributes` filter drivers
//! (git-lfs, say) while it computes status, so that call is reachable from an ordinary read.
//!
//! Defining the function here does two things. The standard library's reference resolves to this
//! definition at link time, so the addon no longer imports a symbol musl does not have and musl's
//! loader stops refusing it. And on glibc nothing changes: the call returns glibc's own answer.
//! `engine/scripts/build-addon.mjs` drops the one other thing that kept musl from loading the
//! gnu build — its `DT_NEEDED` entry for glibc's dynamic loader — and asserts that neither import
//! is left.
//!
//! The measurements behind this are in `docs/AI_DEV_KNOWLEDGE_BASE.md`, "Experiment: one Linux
//! binary for both C libraries".

use std::ffi::{c_char, c_void, CStr};

/// The glibc the release build links against (`engine/scripts/build-all.mjs` builds the gnu
/// targets with zig's glibc 2.28). On a musl host there is no glibc to ask, and this is the answer
/// that keeps the standard library on the path it takes on every supported glibc.
const GLIBC_FLOOR: &CStr = c"2.28";

/// `RTLD_NEXT`: `(void *)-1` on glibc and on musl alike.
const RTLD_NEXT: *mut c_void = usize::MAX as *mut c_void;

extern "C" {
    fn dlsym(handle: *mut c_void, symbol: *const c_char) -> *mut c_void;
}

/// glibc's `gnu_get_libc_version`, answered by glibc where there is one.
///
/// `RTLD_NEXT` finds the next definition after the object calling it — glibc's, in a glibc process,
/// however the addon was loaded; nothing, in a musl process. `RTLD_DEFAULT` would not do: wherever
/// this definition comes first in the global scope (an executable that links it — this module's
/// own test — or a host that loads the addon `RTLD_GLOBAL`) it finds this function again, and a
/// glibc process would be told the floor instead of its version.
#[no_mangle]
pub extern "C" fn gnu_get_libc_version() -> *const c_char {
    // SAFETY: `dlsym` with `RTLD_NEXT` and a NUL-terminated name is defined on both C libraries.
    let found = unsafe { dlsym(RTLD_NEXT, c"gnu_get_libc_version".as_ptr()) };
    if found.is_null() {
        return GLIBC_FLOOR.as_ptr();
    }
    // SAFETY: the symbol found is glibc's `const char *gnu_get_libc_version(void)`.
    let glibc =
        unsafe { std::mem::transmute::<*mut c_void, extern "C" fn() -> *const c_char>(found) };
    glibc()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::c_int;

    extern "C" {
        fn confstr(name: c_int, buf: *mut c_char, len: usize) -> usize;
    }

    /// `_CS_GNU_LIBC_VERSION`: glibc's own "glibc 2.NN", reached without `gnu_get_libc_version`.
    const CS_GNU_LIBC_VERSION: c_int = 2;

    #[test]
    fn answers_with_the_running_glibcs_version() {
        let mut buf = [0 as c_char; 64];
        // SAFETY: the buffer and its length match; glibc NUL-terminates what it writes.
        let written = unsafe { confstr(CS_GNU_LIBC_VERSION, buf.as_mut_ptr(), buf.len()) };
        assert!(
            written > 0,
            "confstr(_CS_GNU_LIBC_VERSION) failed: not glibc?"
        );
        // SAFETY: confstr wrote a NUL-terminated string into `buf`.
        let expected = unsafe { CStr::from_ptr(buf.as_ptr()) }
            .to_str()
            .unwrap()
            .trim_start_matches("glibc ")
            .to_owned();

        // SAFETY: the function returns a pointer to a static NUL-terminated string.
        let answered = unsafe { CStr::from_ptr(gnu_get_libc_version()) }
            .to_str()
            .unwrap();

        assert_eq!(answered, expected);
    }
}
