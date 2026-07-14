#include <napi.h>
#include <Processing.NDI.Lib.h>
#include <atomic>
#include <vector>

namespace {

std::atomic<int> g_initCount{0};

void EnsureInitialized() {
  if (g_initCount.fetch_add(1) == 0) {
    NDIlib_initialize();
  }
}

// Runs the (blocking, up to timeoutMs) NDI capture call off the JS thread.
// The frame is copied into plain heap memory before OnOK() hands it back
// as a Buffer, so the SDK-owned frame can be freed immediately in Execute().
class CaptureFrameWorker : public Napi::AsyncWorker {
 public:
  CaptureFrameWorker(Napi::Env env, NDIlib_recv_instance_t receiver, uint32_t timeoutMs)
      : Napi::AsyncWorker(env), deferred_(Napi::Promise::Deferred::New(env)), receiver_(receiver), timeoutMs_(timeoutMs) {}

  Napi::Promise GetPromise() { return deferred_.Promise(); }

 protected:
  void Execute() override {
    NDIlib_video_frame_v2_t frame{};
    NDIlib_frame_type_e type = NDIlib_recv_capture_v3(receiver_, &frame, nullptr, nullptr, timeoutMs_);
    if (type == NDIlib_frame_type_video) {
      width_ = frame.xres;
      height_ = frame.yres;
      strideBytes_ = frame.line_stride_in_bytes > 0 ? frame.line_stride_in_bytes : frame.xres * 4;
      size_t needed = static_cast<size_t>(strideBytes_) * static_cast<size_t>(height_);
      if (frame.p_data) {
        buffer_.assign(frame.p_data, frame.p_data + needed);
        hasFrame_ = true;
      }
      NDIlib_recv_free_video_v2(receiver_, &frame);
    }
  }

  void OnOK() override {
    Napi::Env env = Env();
    if (!hasFrame_) {
      deferred_.Resolve(env.Null());
      return;
    }
    Napi::Object result = Napi::Object::New(env);
    result.Set("width", Napi::Number::New(env, width_));
    result.Set("height", Napi::Number::New(env, height_));
    result.Set("strideBytes", Napi::Number::New(env, strideBytes_));
    result.Set("data", Napi::Buffer<uint8_t>::Copy(env, buffer_.data(), buffer_.size()));
    deferred_.Resolve(result);
  }

  void OnError(const Napi::Error& e) override { deferred_.Reject(e.Value()); }

 private:
  Napi::Promise::Deferred deferred_;
  NDIlib_recv_instance_t receiver_;
  uint32_t timeoutMs_;
  bool hasFrame_ = false;
  int width_ = 0;
  int height_ = 0;
  int strideBytes_ = 0;
  std::vector<uint8_t> buffer_;
};

class NdiReceiver : public Napi::ObjectWrap<NdiReceiver> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "NdiReceiver",
        {
            InstanceMethod("captureFrame", &NdiReceiver::CaptureFrame),
            InstanceMethod("destroy", &NdiReceiver::Destroy),
        });
    exports.Set("NdiReceiver", func);
    return exports;
  }

  explicit NdiReceiver(const Napi::CallbackInfo& info) : Napi::ObjectWrap<NdiReceiver>(info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) {
      Napi::TypeError::New(env, "NdiReceiver requires a url address string (host:port)").ThrowAsJavaScriptException();
      return;
    }

    EnsureInitialized();

    urlAddress_ = info[0].As<Napi::String>().Utf8Value();

    NDIlib_source_t source{};
    source.p_ndi_name = nullptr;
    source.p_url_address = urlAddress_.c_str();

    NDIlib_recv_create_v3_t createSettings{};
    createSettings.source_to_connect_to = source;
    createSettings.color_format = NDIlib_recv_color_format_RGBX_RGBA;
    createSettings.bandwidth = NDIlib_recv_bandwidth_highest;
    createSettings.allow_video_fields = false;
    createSettings.p_ndi_recv_name = "Presentation Commander";

    receiver_ = NDIlib_recv_create_v3(&createSettings);
    if (!receiver_) {
      Napi::Error::New(env, "Failed to create NDI receiver — is the NDI runtime installed?")
          .ThrowAsJavaScriptException();
    }
  }

  ~NdiReceiver() override {
    if (receiver_) {
      NDIlib_recv_destroy(receiver_);
      receiver_ = nullptr;
    }
  }

 private:
  Napi::Value CaptureFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (!receiver_) {
      Napi::Error::New(env, "Receiver has been destroyed").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    uint32_t timeoutMs = 1000;
    if (info.Length() >= 1 && info[0].IsNumber()) {
      timeoutMs = info[0].As<Napi::Number>().Uint32Value();
    }

    auto* worker = new CaptureFrameWorker(env, receiver_, timeoutMs);
    Napi::Promise promise = worker->GetPromise();
    worker->Queue();
    return promise;
  }

  Napi::Value Destroy(const Napi::CallbackInfo& info) {
    if (receiver_) {
      NDIlib_recv_destroy(receiver_);
      receiver_ = nullptr;
    }
    return info.Env().Undefined();
  }

  NDIlib_recv_instance_t receiver_ = nullptr;
  std::string urlAddress_;
};

Napi::Object InitAll(Napi::Env env, Napi::Object exports) { return NdiReceiver::Init(env, exports); }

}  // namespace

NODE_API_MODULE(ndi_receive, InitAll)
