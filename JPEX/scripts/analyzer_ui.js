/**
 * Japanese Sentence Analyzer - analyzer_ui.js
 * Xử lý toàn bộ logic tương tác UI Full-Screen Workspace:
 * - Điều hướng Không gian Từ điển & Thẻ nhớ (Tab reuse)
 * - Render bảng token 2 cột, Furigana toggle, Audio TTS
 * - Lịch sử phân tích gần đây (Recent History)
 * - Tra cứu chi tiết và lưu Flashcard liên thông
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const inputEl = document.getElementById('sentence-input');
  const btnAnalyze = document.getElementById('btn-analyze');
  const btnClear = document.getElementById('btn-clear');
  const charCounter = document.getElementById('char-counter');
  const loadingBar = document.getElementById('loading-bar');
  const sampleChips = document.querySelectorAll('.sample-chip');
  const btnOpenWorkspace = document.getElementById('btn-open-workspace');

  // History Elements
  const sectionHistory = document.getElementById('section-history');
  const historyList = document.getElementById('history-list');
  const btnClearHistory = document.getElementById('btn-clear-history');

  // Right Column Views
  const emptyStateView = document.getElementById('empty-state-view');
  const sectionOverview = document.getElementById('section-overview');
  const sentenceDisplay = document.getElementById('sentence-display');
  const readingDisplay = document.getElementById('reading-display');
  const meaningDisplay = document.getElementById('meaning-display');
  const toggleFurigana = document.getElementById('toggle-furigana');
  const translationProviderBadge = document.getElementById('translation-provider-badge');
  const btnCopySentence = document.getElementById('btn-copy-sentence');
  const btnCopyReading = document.getElementById('btn-copy-reading');
  const btnCopyTranslation = document.getElementById('btn-copy-translation');

  // Tokens Table Elements
  const sectionTokens = document.getElementById('section-tokens');
  const tokensTbody = document.getElementById('tokens-tbody');
  const tokenCountLabel = document.getElementById('token-count-label');

  // Inspector Modal Elements
  const modalOverlay = document.getElementById('modal-overlay');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalSurface = document.getElementById('modal-surface');
  const modalReading = document.getElementById('modal-reading');
  const modalBaseForm = document.getElementById('modal-base-form');
  const modalPosConj = document.getElementById('modal-pos-conj');
  const modalMeaning = document.getElementById('modal-meaning');
  const modalKanjiSection = document.getElementById('modal-kanji-section');
  const modalKanjiList = document.getElementById('modal-kanji-list');
  const btnModalTts = document.getElementById('btn-modal-tts');
  const btnModalSave = document.getElementById('btn-modal-save');
  const btnModalLookup = document.getElementById('btn-modal-lookup');
  const toastMsg = document.getElementById('toast-msg');

  // State
  let currentAnalysis = null;
  let currentActiveToken = null;
  let currentTranslationText = '';

  // Khởi tạo Analyzer Engine
  if (typeof SentenceAnalyzer !== 'undefined' && SentenceAnalyzer.init) {
    SentenceAnalyzer.init().catch(err => console.warn('[AnalyzerUI] Lỗi nạp data:', err));
  }

  // Cập nhật số ký tự
  function updateCharCount() {
    const len = inputEl.value.length;
    charCounter.textContent = `${len} / 500 ký tự`;
    btnAnalyze.disabled = len === 0 || len > 500;
  }

  inputEl.addEventListener('input', updateCharCount);

  // Phím tắt Enter & Ctrl+Enter để phân tích
  inputEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key === 'Enter') || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      if (!btnAnalyze.disabled) {
        startAnalysis();
      }
    }
  });

  // Nút xóa nội dung
  btnClear.addEventListener('click', () => {
    inputEl.value = '';
    updateCharCount();
    emptyStateView.style.display = 'block';
    sectionOverview.style.display = 'none';
    sectionTokens.style.display = 'none';
    inputEl.focus();
  });

  // Mở tab Không gian Từ điển & Thẻ nhớ Toàn màn hình
  if (btnOpenWorkspace) {
    btnOpenWorkspace.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'openWorkspace', view: 'overview' });
      } else {
        window.location.href = 'workspace.html';
      }
    });
  }

  // Click vào các câu mẫu thử nhanh
  sampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const sampleText = chip.getAttribute('data-sample');
      if (sampleText) {
        inputEl.value = sampleText;
        updateCharCount();
        startAnalysis();
      }
    });
  });

  // Nút Phân tích câu chính
  btnAnalyze.addEventListener('click', startAnalysis);

  /**
   * Thực hiện phân tích câu
   */
  async function startAnalysis() {
    const rawText = inputEl.value.trim();
    if (!rawText) return;

    // Trạng thái Loading
    loadingBar.style.display = 'block';
    btnAnalyze.disabled = true;
    emptyStateView.style.display = 'none';
    sectionOverview.style.display = 'none';
    sectionTokens.style.display = 'none';

    try {
      const res = await SentenceAnalyzer.analyze(rawText);
      if (!res || !res.success) {
        showToast(res ? res.error : 'Không thể phân tích câu này', 4000);
        emptyStateView.style.display = 'block';
        return;
      }

      currentAnalysis = res;
      renderOverview(res);
      renderTokensTable(res.tokens);

      // Kích hoạt hiển thị
      emptyStateView.style.display = 'none';
      sectionOverview.style.display = 'block';
      sectionTokens.style.display = 'block';

      // Lưu lịch sử phân tích
      saveToAnalysisHistory(rawText);

      // Gọi dịch nghĩa toàn câu
      fetchFullSentenceTranslation(rawText);
    } catch (err) {
      console.error('[AnalyzerUI] Lỗi phân tích:', err);
      showToast('Đã xảy ra lỗi: ' + err.message, 4000);
      emptyStateView.style.display = 'block';
    } finally {
      loadingBar.style.display = 'none';
      btnAnalyze.disabled = false;
    }
  }

  /**
   * Render Section B: Sentence Overview
   */
  function renderOverview(data) {
    updateSentenceDisplay(data);

    readingDisplay.textContent = data.reading || '—';
    readingDisplay.style.display = toggleFurigana.checked ? 'none' : 'block';

    meaningDisplay.innerHTML = '<span style="color: var(--text-secondary); font-style: italic;">Đang lấy bản dịch tiếng Việt toàn câu...</span>';
  }

  function updateSentenceDisplay(data) {
    if (!data) return;
    if (toggleFurigana.checked) {
      sentenceDisplay.innerHTML = data.furiganaHtml || escapeHtml(data.sentence);
      readingDisplay.style.display = 'none';
    } else {
      sentenceDisplay.textContent = data.sentence;
      readingDisplay.style.display = 'block';
    }
  }

  toggleFurigana.addEventListener('change', () => {
    if (currentAnalysis) {
      updateSentenceDisplay(currentAnalysis);
    }
  });

  /**
   * Gọi Sentence Translation Provider để dịch nghĩa toàn câu
   */
  async function fetchFullSentenceTranslation(sentence) {
    currentTranslationText = '';
    translationProviderBadge.textContent = 'Đang dịch...';
    translationProviderBadge.style.color = '#f59e0b';

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'translateSentence', text: sentence }, (res) => {
        if (chrome.runtime.lastError || !res || !res.success) {
          const err = (res && res.error) || (chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Lỗi kết nối dịch vụ dịch');
          meaningDisplay.innerHTML = `
            <span style="color: #ef4444;">Chưa tải được bản dịch toàn câu (${escapeHtml(err)}).</span>
            <button id="btn-retry-translate" style="margin-left: 8px; padding: 2px 8px; font-size: 11px; cursor: pointer; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-primary);">Thử lại</button>
          `;
          translationProviderBadge.textContent = 'Lỗi dịch';
          translationProviderBadge.style.color = '#ef4444';

          const btnRetry = document.getElementById('btn-retry-translate');
          if (btnRetry) {
            btnRetry.addEventListener('click', () => fetchFullSentenceTranslation(sentence));
          }
        } else {
          currentTranslationText = res.data.translatedText;
          meaningDisplay.textContent = currentTranslationText;
          translationProviderBadge.textContent = res.data.provider || 'Nihongo Translation Core';
          translationProviderBadge.style.color = '#10b981';
        }
      });
    } else {
      meaningDisplay.textContent = 'Không có kết nối background';
      translationProviderBadge.textContent = 'Offline';
    }
  }

  /**
   * Render Section C: Token Analysis Table
   */
  function renderTokensTable(tokens) {
    tokensTbody.innerHTML = '';
    const nonPunctCount = tokens.filter(t => !t.isPunctuation).length;
    tokenCountLabel.textContent = `${tokens.length} thành phần (${nonPunctCount} từ vựng/ngữ pháp)`;

    tokens.forEach((token, index) => {
      const tr = document.createElement('tr');

      let badgeClass = 'badge-vocab';
      if (token.isPunctuation) badgeClass = 'badge-punct';
      else if (token.isGrammar || token.isParticle || token.isAuxiliary || token.isDemonstrative) badgeClass = 'badge-grammar';
      else if (token.conjugation || (token.partOfSpeech && token.partOfSpeech.includes('Động từ'))) badgeClass = 'badge-verb';

      let posText = token.partOfSpeech || 'Từ vựng';
      if (token.conjugation) {
        posText += ` <span style="font-size: 11px; opacity: 0.85;">(${token.conjugation})</span>`;
      }

      let meaningText = token.meaning || '—';
      if (token.grammarRole && token.grammarRole !== 'Thành phần từ vựng' && !meaningText.includes(token.grammarRole)) {
        meaningText += ` <span style="font-size: 11px; color: var(--text-secondary);">[${token.grammarRole}]</span>`;
      }

      tr.innerHTML = `
        <td style="color: var(--text-secondary); font-size: 12px;">${index + 1}</td>
        <td class="token-surface-cell">${escapeHtml(token.surface)}</td>
        <td class="token-reading-cell">${escapeHtml(token.reading)}</td>
        <td class="token-base-cell">${escapeHtml(token.baseForm || token.surface)}</td>
        <td>
          <span class="badge-tag ${badgeClass}">${posText}</span>
        </td>
        <td style="max-width: 340px;">${meaningText}</td>
      `;

      tr.addEventListener('click', () => {
        openTokenInspector(token);
      });

      tokensTbody.appendChild(tr);
    });
  }

  /**
   * Render Section D: Token Details Inspector Modal
   */
  function openTokenInspector(token) {
    currentActiveToken = token;

    modalSurface.querySelector('span').textContent = token.surface;
    modalReading.textContent = token.reading !== '—' ? token.reading : (token.baseReading || token.surface);
    modalBaseForm.textContent = token.baseForm || token.surface;

    let posFull = token.partOfSpeech || 'Từ vựng';
    if (token.conjugation) {
      posFull += ` • ${token.conjugation}`;
    }
    modalPosConj.textContent = posFull;

    let meanFull = token.meaning || 'Chưa có thông tin nghĩa chi tiết';
    if (token.grammarRole && token.grammarRole !== 'Thành phần từ vựng') {
      meanFull += `\n• Chức năng: ${token.grammarRole}`;
    }
    modalMeaning.textContent = meanFull;

    // Kanji Breakdown
    const kanjiBreakdown = SentenceAnalyzer.getKanjiBreakdown(token.surface || token.baseForm);
    if (kanjiBreakdown && kanjiBreakdown.length > 0) {
      modalKanjiSection.style.display = 'block';
      modalKanjiList.innerHTML = '';

      kanjiBreakdown.forEach(k => {
        const item = document.createElement('div');
        item.className = 'kanji-breakdown-item';
        let detailStr = `<b>Hán Việt:</b> ${k.hanviet || 'CHƯA RÕ'}`;
        if (k.meaning) detailStr += ` • <b>Nghĩa:</b> ${k.meaning}`;
        if (k.strokes) detailStr += ` (${k.strokes} nét)`;

        item.innerHTML = `
          <div class="kanji-char-badge">${escapeHtml(k.char)}</div>
          <div class="kanji-char-info">${detailStr}</div>
        `;
        modalKanjiList.appendChild(item);
      });
    } else {
      modalKanjiSection.style.display = 'none';
      modalKanjiList.innerHTML = '';
    }

    modalOverlay.classList.add('active');
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    currentActiveToken = null;
  }

  btnCloseModal.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeModal();
    }
  });

  // Phát âm giọng Nhật (TTS)
  btnModalTts.addEventListener('click', () => {
    if (!currentActiveToken) return;
    const wordToSpeak = currentActiveToken.surface || currentActiveToken.baseForm;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(wordToSpeak);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } else {
      showToast('Trình duyệt không hỗ trợ Web Speech API', 2500);
    }
  });

  // Lưu vào Flashcard
  btnModalSave.addEventListener('click', async () => {
    if (!currentActiveToken) return;
    const t = currentActiveToken;
    const vocabData = {
      kanji: t.surface,
      word: t.surface,
      reading: t.reading !== '—' ? t.reading : (t.baseReading || t.surface),
      meaningVi: t.meaning || 'Từ vựng tiếng Nhật',
      meaning: t.meaning || 'Từ vựng tiếng Nhật',
      hanviet: t.hanviet || '',
      pos: t.partOfSpeech || 'Từ vựng',
      source: 'sentence-analyzer',
      createdAt: new Date().toISOString()
    };

    if (typeof addWordToReview === 'function') {
      try {
        await addWordToReview(vocabData, 'deck_default');
        showToast(`⭐ Đã lưu "${t.surface}" vào ôn tập Flashcard!`, 3000);
      } catch (e) {
        showToast('Lỗi lưu từ: ' + e.message, 3000);
      }
    } else if (typeof saveWord === 'function') {
      try {
        await saveWord(vocabData);
        showToast(`⭐ Đã lưu "${t.surface}" vào Flashcard!`, 3000);
      } catch (e) {
        showToast('Lỗi lưu từ: ' + e.message, 3000);
      }
    } else {
      showToast(`⭐ Đã ghi nhận từ "${t.surface}"`, 2500);
    }
  });

  // Nút "Tra cứu chi tiết": Mở thẳng Không gian Từ điển Toàn màn hình (Workspace)
  btnModalLookup.addEventListener('click', () => {
    if (!currentActiveToken) return;
    const target = currentActiveToken.baseForm || currentActiveToken.surface;
    closeModal();

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'openWorkspace',
        view: 'dict',
        query: target
      });
    } else {
      window.location.href = `workspace.html?view=dict&q=${encodeURIComponent(target)}`;
    }
  });

  // Sao chép
  btnCopySentence.addEventListener('click', () => {
    if (currentAnalysis && currentAnalysis.sentence) {
      copyToClipboard(currentAnalysis.sentence, btnCopySentence, 'Đã sao chép câu gốc!');
    }
  });

  btnCopyReading.addEventListener('click', () => {
    if (currentAnalysis && currentAnalysis.reading) {
      copyToClipboard(currentAnalysis.reading, btnCopyReading, 'Đã sao chép cách đọc!');
    }
  });

  btnCopyTranslation.addEventListener('click', () => {
    if (currentTranslationText) {
      copyToClipboard(currentTranslationText, btnCopyTranslation, 'Đã sao chép bản dịch!');
    } else {
      showToast('Chưa có bản dịch hoàn chỉnh để sao chép', 2500);
    }
  });

  function copyToClipboard(text, btnElement, successMsg) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      btnElement.classList.add('copied');
      const originalText = btnElement.innerHTML;
      btnElement.innerHTML = `✅ Đã sao chép`;
      setTimeout(() => {
        btnElement.classList.remove('copied');
        btnElement.innerHTML = originalText;
      }, 1500);
      showToast(successMsg, 2500);
    }).catch(() => {
      showToast('Không thể sao chép vào clipboard', 2500);
    });
  }

  // Toast helper
  let toastTimer = null;
  function showToast(msg, duration = 3000) {
    clearTimeout(toastTimer);
    toastMsg.querySelector('span').textContent = msg;
    toastMsg.classList.add('show');
    toastTimer = setTimeout(() => {
      toastMsg.classList.remove('show');
    }, duration);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ========================================================
  // LỊCH SỬ PHÂN TÍCH GẦN ĐÂY (ANALYSIS HISTORY)
  // ========================================================
  const HISTORY_STORAGE_KEY = 'jpex_analyzer_history';

  function loadAnalysisHistory() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([HISTORY_STORAGE_KEY], (res) => {
        const history = res[HISTORY_STORAGE_KEY] || [];
        renderHistoryList(history);
      });
    }
  }

  function renderHistoryList(history) {
    if (!Array.isArray(history) || history.length === 0) {
      sectionHistory.style.display = 'none';
      return;
    }

    sectionHistory.style.display = 'block';
    historyList.innerHTML = '';

    history.forEach(sentence => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.textContent = sentence;
      div.title = sentence;
      div.addEventListener('click', () => {
        inputEl.value = sentence;
        updateCharCount();
        startAnalysis();
      });
      historyList.appendChild(div);
    });
  }

  function saveToAnalysisHistory(sentence) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get([HISTORY_STORAGE_KEY], (res) => {
      let history = res[HISTORY_STORAGE_KEY] || [];
      history = history.filter(s => s !== sentence);
      history.unshift(sentence);
      if (history.length > 8) history = history.slice(0, 8);
      chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: history }, () => {
        renderHistoryList(history);
      });
    });
  }

  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove([HISTORY_STORAGE_KEY], () => {
          renderHistoryList([]);
        });
      }
    });
  }

  // ========================================================
  // TỰ ĐỘNG NẠP CÂU TỪ URL PARAM HOẶC STORAGE
  // ========================================================
  async function checkInitialInput() {
    loadAnalysisHistory();

    const urlParams = new URLSearchParams(window.location.search);
    const textFromUrl = urlParams.get('text');
    if (textFromUrl && textFromUrl.trim()) {
      inputEl.value = textFromUrl.trim();
      updateCharCount();
      await startAnalysis();
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['pendingAnalyzerText'], async (res) => {
        if (res && res.pendingAnalyzerText && res.pendingAnalyzerText.trim()) {
          const stored = res.pendingAnalyzerText.trim();
          chrome.storage.local.remove(['pendingAnalyzerText']);
          inputEl.value = stored;
          updateCharCount();
          await startAnalysis();
        }
      });
    }
  }

  await checkInitialInput();
});
