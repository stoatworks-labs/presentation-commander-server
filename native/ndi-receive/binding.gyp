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
            "ldflags": ["-Wl,-rpath,/usr/lib", "-Wl,-rpath,/usr/local/lib"]
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
