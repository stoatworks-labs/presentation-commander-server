#include <napi.h>
#include <Processing.NDI.Lib.h>
#include <atomic>
#include <cstring>
#include <vector>

namespace {

std::atomic<int> g_initCount{0};

void EnsureInitialized() {
  if (g_initCount.fetch_add(1) == 0) {
    NDIlib_initialize();
  }
}

// Runs the actual (blocking) NDI send call off the JS thread. The frame
// buffer is copied into plain heap memory up front (on the JS thread, in
// the constructor) so Execute() never touches anything V8-managed.
class SendFrameWorker : public Napi::AsyncWorker {
 public:
  SendFrameWorker(Napi::Env env, NDIlib_send_instance_t sender, const uint8_t* data, size_t dataLen, int width,
                   int height)
      : Napi::AsyncWorker(env),
        deferred_(Napi::Promise::Deferred::New(env)),
        sender_(sender),
        buffer_(data, data + dataLen),
        width_(width),
        height_(height) {}

  Napi::Promise GetPromise() { return deferred_.Promise(); }

 protected:
  void Execute() override {
    NDIlib_video_frame_v2_t frame{};
    frame.xres = width_;
    frame.yres = height_;
    frame.FourCC = NDIlib_FourCC_type_RGBA;
    frame.frame_rate_N = 30;
    frame.frame_rate_D = 1;
    frame.picture_aspect_ratio = static_cast<float>(width_) / static_cast<float>(height_);
    frame.frame_format_type = NDIlib_frame_format_type_progressive;
    frame.p_data = buffer_.data();
    frame.line_stride_in_bytes = width_ * 4;
    frame.p_metadata = nullptr;

    NDIlib_send_send_video_v2(sender_, &frame);
  }

  void OnOK() override { deferred_.Resolve(Env().Undefined()); }
  void OnError(const Napi::Error& e) override { deferred_.Reject(e.Value()); }

 private:
  Napi::Promise::Deferred deferred_;
  NDIlib_send_instance_t sender_;
  std::vector<uint8_t> buffer_;
  int width_;
  int height_;
};

class NdiSender : public Napi::ObjectWrap<NdiSender> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "NdiSender",
        {
            InstanceMethod("sendFrame", &NdiSender::SendFrame),
            InstanceMethod("destroy", &NdiSender::Destroy),
        });
    exports.Set("NdiSender", func);
    return exports;
  }

  explicit NdiSender(const Napi::CallbackInfo& info) : Napi::ObjectWrap<NdiSender>(info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) {
      Napi::TypeError::New(env, "NdiSender requires a name string").ThrowAsJavaScriptException();
      return;
    }

    EnsureInitialized();

    std::string name = info[0].As<Napi::String>().Utf8Value();
    NDIlib_send_create_t createSettings{};
    createSettings.p_ndi_name = name.c_str();
    createSettings.clock_video = false;
    createSettings.clock_audio = false;

    sender_ = NDIlib_send_create(&createSettings);
    if (!sender_) {
      Napi::Error::New(env, "Failed to create NDI sender — is the NDI runtime installed?")
          .ThrowAsJavaScriptException();
    }
  }

  ~NdiSender() override {
    if (sender_) {
      NDIlib_send_destroy(sender_);
      sender_ = nullptr;
    }
  }

 private:
  Napi::Value SendFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (!sender_) {
      Napi::Error::New(env, "Sender has been destroyed").ThrowAsJavaScriptException();
      return env.Undefined();
    }
    if (info.Length() < 3 || !info[0].IsBuffer() || !info[1].IsNumber() || !info[2].IsNumber()) {
      Napi::TypeError::New(env, "sendFrame(buffer, width, height) expected").ThrowAsJavaScriptException();
      return env.Undefined();
    }

    Napi::Buffer<uint8_t> buf = info[0].As<Napi::Buffer<uint8_t>>();
    int width = info[1].As<Napi::Number>().Int32Value();
    int height = info[2].As<Napi::Number>().Int32Value();

    if (buf.Length() < static_cast<size_t>(width) * static_cast<size_t>(height) * 4) {
      Napi::RangeError::New(env, "Buffer too small for the given width/height (expected RGBA)")
          .ThrowAsJavaScriptException();
      return env.Undefined();
    }

    auto* worker = new SendFrameWorker(env, sender_, buf.Data(), buf.Length(), width, height);
    Napi::Promise promise = worker->GetPromise();
    worker->Queue();
    return promise;
  }

  Napi::Value Destroy(const Napi::CallbackInfo& info) {
    if (sender_) {
      NDIlib_send_destroy(sender_);
      sender_ = nullptr;
    }
    return info.Env().Undefined();
  }

  NDIlib_send_instance_t sender_ = nullptr;
};

Napi::Object InitAll(Napi::Env env, Napi::Object exports) { return NdiSender::Init(env, exports); }

}  // namespace

NODE_API_MODULE(ndi_send, InitAll)
