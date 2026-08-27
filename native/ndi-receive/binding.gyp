{
  "variables": {
    "ndi_sdk_dir%": "<!(node ./scripts/resolve-sdk-dir.js)"
  },
  "targets": [
    {
      "target_name": "ndi_receive",
      "sources": ["src/addon.cc"],
      "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")", "<(ndi_sdk_dir)/include"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "cflags_cc": ["-std=c++17", "-fexceptions"],
      "conditions": [
        [
          "OS=='mac'",
          {
            "libraries": ["<(ndi_sdk_dir)/lib/macOS/libndi.dylib"],
            "xcode_settings": {
              "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
              "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
              "OTHER_LDFLAGS": [
                # @loader_path first, for the same reason as $ORIGIN on Linux:
                # libndi.dylib is bundled beside the addon and the .node links
                # it as @rpath/libndi.dylib, so without this the only rpaths are
                # the BUILD machine's SDK directory and /usr/local/lib.
                "-Wl,-rpath,@loader_path",
                "-Wl,-rpath,<(ndi_sdk_dir)/lib/macOS",
                "-Wl,-rpath,/usr/local/lib"
              ]
            }
          }
        ],
        [
          "OS=='linux'",
          {
            "libraries": ["-lndi"],
            # $ORIGIN first: the release workflow bundles libndi.so.6 beside the
            # built addon, and without this the loader never looks there — it
            # only searched the two absolute paths below, which exist on the CI
            # builder (the SDK is installed into /usr/lib there) and on nobody
            # else's machine. Shipped v1.1.0/v1.2.0 died at startup on a clean
            # box with "libndi.so.6: cannot open shared object file".
            # $$ is gyp's escape for a literal $; the quotes stop the shell
            # expanding it before ld sees it.
            "ldflags": [
              "-Wl,-rpath,'$$ORIGIN'",
              "-Wl,-rpath,/usr/lib",
              "-Wl,-rpath,/usr/local/lib"
            ]
          }
        ],
        [
          "OS=='win'",
          {
            "libraries": ["<(ndi_sdk_dir)\\Lib\\x64\\Processing.NDI.Lib.x64.lib"]
          }
        ]
      ]
    }
  ]
}
