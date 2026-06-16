export function isVoiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createVoiceInput(options) {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) {
    throw new Error("SpeechRecognition is not supported in this browser");
  }

  const recognition = new SpeechRecognitionCtor();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = (options && options.lang) || "en-US";

  let _listening = false;
  let finalText = "";

  recognition.onresult = (event) => {
    let interimText = "";
    finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }
    if (interimText && options.onInterim) {
      options.onInterim(interimText);
    }
    if (finalText && options.onFinal) {
      options.onFinal(finalText);
    }
  };

  recognition.onend = () => {
    _listening = false;
    if (finalText && options.onFinal) {
      options.onFinal(finalText);
      finalText = "";
    }
  };

  recognition.onerror = (event) => {
    _listening = false;
    const err = event.error || event;
    const msg = (err && err.message) || String(err);
    if (options.onError) {
      options.onError(msg);
    }
  };

  return {
    start() {
      if (_listening) return;
      finalText = "";
      _listening = true;
      try {
        recognition.start();
      } catch (e) {
        _listening = false;
        if (options.onError) {
          options.onError(e.message || String(e));
        }
      }
    },
    stop() {
      if (!_listening) return;
      recognition.stop();
      _listening = false;
    },
    get isListening() {
      return _listening;
    }
  };
}
