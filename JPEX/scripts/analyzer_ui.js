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
  const literalBox = document.getElementById('literal-box');
  const literalDisplay = document.getElementById('literal-display');
  const btnCopySentence = document.getElementById('btn-copy-sentence');
  const btnCopyReading = document.getElementById('btn-copy-reading');
  const btnCopyTranslation = document.getElementById('btn-copy-translation');

  // Semantic Chunks Elements
  const sectionChunks = document.getElementById('section-chunks');
  const chunksGrid = document.getElementById('chunks-grid');
  const chunksCountLabel = document.getElementById('chunks-count-label');

  // Grammar Points Elements
  const sectionGrammar = document.getElementById('section-grammar');
  const grammarGrid = document.getElementById('grammar-grid');
  const grammarCountLabel = document.getElementById('grammar-count-label');

  // Sentence Logic Elements
  const sectionLogic = document.getElementById('section-logic');
  const logicBox = document.getElementById('logic-box');

  // Tokens Table Elements
  const sectionTokens = document.getElementById('section-tokens');
  const tokensTbody = document.getElementById('tokens-tbody');
  const tokenCountLabel = document.getElementById('token-count-label');

  // Inspector Modal Elements
  const modalOverlay = document.getElementById('modal-overlay');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalSurface = document.getElementById('modal-surface');
  const modalReading = document.getElementById('modal-reading');
  const modalRomaji = document.getElementById('modal-romaji');
  const modalBaseForm = document.getElementById('modal-base-form');
  const modalPosConj = document.getElementById('modal-pos-conj');
  const modalHanvietSection = document.getElementById('modal-hanviet-section');
  const modalHanviet = document.getElementById('modal-hanviet');
  const modalMeaning = document.getElementById('modal-meaning');
  const btnToggleEditMeaning = document.getElementById('btn-toggle-edit-meaning');
  const modalMeaningEdit = document.getElementById('modal-meaning-edit');
  const modalFolderSelect = document.getElementById('modal-folder-select');
  const modalKanjiSection = document.getElementById('modal-kanji-section');
  const modalKanjiList = document.getElementById('modal-kanji-list');
  const btnModalTts = document.getElementById('btn-modal-tts');
  const btnModalSave = document.getElementById('btn-modal-save');
  const btnModalLookup = document.getElementById('btn-modal-lookup');
  const toastMsg = document.getElementById('toast-msg');

  // State Management (100% Local-First Offline Engine)
  let currentAnalysis = null;
  let currentActiveToken = null;
  let currentTranslationText = '';
  let activeSessionId = 0;

  // Cleanup legacy AI keys from storage (Privacy & Clean state migration)
  function cleanupLegacyAiSettings() {
    const AI_STORAGE_KEYS = [
      'jpex_analyzer_settings',
      'gemini_api_key',
      'ai_api_key',
      'ai_model',
      'gemini_model',
      'ai_provider'
    ];
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(AI_STORAGE_KEYS, () => {
        // Legacy AI settings removed safely without affecting user data
      });
    }
    try {
      AI_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }

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
    sectionChunks.style.display = 'none';
    sectionGrammar.style.display = 'none';
    sectionLogic.style.display = 'none';
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
  btnAnalyze.addEventListener('click', () => startAnalysis());

  /**
   * Thực hiện phân tích câu (Local-first + Optional AI)
   */
  async function startAnalysis() {
    const rawText = inputEl.value.trim();
    if (!rawText) return;

    // Ngăn chặn race condition giữa nhiều request phân tích liên tiếp
    const thisSession = ++activeSessionId;

    // Trạng thái Loading
    loadingBar.style.display = 'block';
    btnAnalyze.disabled = true;
    emptyStateView.style.display = 'none';

    try {
      const res = await SentenceAnalyzer.analyze(rawText, {
        mode: 'local'
      });

      // Kiểm tra race condition: nếu phiên phân tích đã thay đổi, bỏ qua kết quả cũ
      if (thisSession !== activeSessionId) {
        return;
      }

      if (!res || !res.success) {
        showToast(res ? res.error : 'Không thể phân tích câu này', 4000);
        emptyStateView.style.display = 'block';
        return;
      }

      currentAnalysis = res;

      // 1. Render Tổng quan (Sentence Overview & Furigana)
      renderOverview(res);

      // 2. Render Semantic Chunks (Cụm nghĩa Bunsetsu)
      renderChunks(res.chunks);

      // 3. Render Key Grammar Points (Trọng tâm ngữ pháp)
      renderGrammarPoints(res.grammarPoints);

      // 4. Render Sentence Logic & Flow (Mạch logic)
      renderSentenceLogic(res.sentenceLogic);

      // 5. Render Bảng Token 2 cột chi tiết
      renderTokensTable(res.tokens);

      // 6. Xử lý Dịch nghĩa toàn câu & Dịch sát cấu trúc
      fetchFullSentenceTranslation(rawText);

      if (literalBox && literalDisplay) {
        if (res.literalTranslation && res.literalTranslation.trim()) {
          literalDisplay.textContent = res.literalTranslation;
          literalBox.style.display = 'block';
        } else {
          literalBox.style.display = 'none';
        }
      }

      // Hiển thị các khối kết quả
      emptyStateView.style.display = 'none';
      sectionOverview.style.display = 'block';
      sectionTokens.style.display = 'block';

      // Lưu lịch sử phân tích
      saveToAnalysisHistory(rawText);

    } catch (err) {
      if (thisSession !== activeSessionId) return;
      console.error('[AnalyzerUI] Lỗi phân tích:', err);
      showToast('Đã xảy ra lỗi: ' + err.message, 4000);
      emptyStateView.style.display = 'block';
    } finally {
      if (thisSession === activeSessionId) {
        loadingBar.style.display = 'none';
        btnAnalyze.disabled = false;
      }
    }
  }

  /**
   * Render Section B: Sentence Overview
   */
  function renderOverview(data) {
    updateSentenceDisplay(data);

    readingDisplay.textContent = data.reading || '—';
    readingDisplay.style.display = toggleFurigana.checked ? 'none' : 'block';

    if (!data.naturalTranslation) {
      meaningDisplay.innerHTML = '<span style="color: var(--text-secondary); font-style: italic;">Đang lấy bản dịch tiếng Việt toàn câu...</span>';
    }
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

  if (toggleFurigana) {
    toggleFurigana.addEventListener('change', () => {
      if (currentAnalysis) {
        updateSentenceDisplay(currentAnalysis);
      }
    });
  }

  /**
   * Render Chunks (Cụm nghĩa Bunsetsu)
   */
  function renderChunks(chunks) {
    if (!sectionChunks || !chunksGrid) return;
    if (!Array.isArray(chunks) || chunks.length === 0) {
      sectionChunks.style.display = 'none';
      return;
    }

    sectionChunks.style.display = 'block';
    if (chunksCountLabel) chunksCountLabel.textContent = `${chunks.length} cụm`;
    chunksGrid.innerHTML = '';

    chunks.forEach((chk, idx) => {
      const card = document.createElement('div');
      card.className = 'chunk-card';
      card.setAttribute('data-chunk-id', chk.id || `chk_${idx}`);

      card.innerHTML = `
        <div class="chunk-header">
          <span class="chunk-surface">${escapeHtml(chk.surface)}</span>
          <span class="chunk-role-badge">${escapeHtml(chk.roleVi || 'Cụm nghĩa')}</span>
        </div>
        <div class="chunk-meaning">${escapeHtml(chk.meaningVi || '—')}</div>
        ${chk.explanationVi ? `<div class="chunk-explanation">${escapeHtml(chk.explanationVi)}</div>` : ''}
      `;

      card.addEventListener('mouseenter', () => highlightTokens(chk.tokenIds));
      card.addEventListener('mouseleave', () => clearTokenHighlights());

      chunksGrid.appendChild(card);
    });
  }

  /**
   * Render Key Grammar Points (Ngữ pháp trọng tâm)
   */
  function renderGrammarPoints(grammarPoints) {
    if (!sectionGrammar || !grammarGrid) return;
    if (!Array.isArray(grammarPoints) || grammarPoints.length === 0) {
      sectionGrammar.style.display = 'none';
      return;
    }

    sectionGrammar.style.display = 'block';
    if (grammarCountLabel) grammarCountLabel.textContent = `${grammarPoints.length} điểm ngữ pháp`;
    grammarGrid.innerHTML = '';

    grammarPoints.forEach(gp => {
      const card = document.createElement('div');
      card.className = 'grammar-card';

      card.innerHTML = `
        <div class="grammar-header">
          <span class="grammar-pattern">${escapeHtml(gp.pattern)}</span>
          ${gp.level ? `<span class="grammar-level-badge">${escapeHtml(gp.level)}</span>` : ''}
        </div>
        <div class="grammar-meaning">${escapeHtml(gp.meaningVi || '')}</div>
        ${gp.explanationVi ? `<div class="grammar-explanation">${escapeHtml(gp.explanationVi)}</div>` : ''}
      `;

      card.addEventListener('mouseenter', () => highlightTokens(gp.tokenIds));
      card.addEventListener('mouseleave', () => clearTokenHighlights());

      grammarGrid.appendChild(card);
    });
  }

  /**
   * Render Sentence Logic & Flow
   */
  function renderSentenceLogic(logicText) {
    if (!sectionLogic || !logicBox) return;
    if (!logicText || !logicText.trim()) {
      sectionLogic.style.display = 'none';
      return;
    }

    sectionLogic.style.display = 'block';
    logicBox.innerHTML = escapeHtml(logicText).replace(/\n/g, '<br>');
  }

  // Token Highlighting Helpers
  function highlightTokens(tokenIds) {
    if (!Array.isArray(tokenIds) || tokenIds.length === 0 || !tokensTbody) return;
    tokenIds.forEach(id => {
      const row = tokensTbody.querySelector(`tr[data-token-id="${id}"]`);
      if (row) row.classList.add('highlight-row');
    });
  }

  function clearTokenHighlights() {
    if (!tokensTbody) return;
    const highlighted = tokensTbody.querySelectorAll('tr.highlight-row');
    highlighted.forEach(r => r.classList.remove('highlight-row'));
  }

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
      if (token.id) {
        tr.setAttribute('data-token-id', token.id);
      }

      let badgeClass = 'badge-vocab';
      if (token.isPunctuation) badgeClass = 'badge-punct';
      else if (token.isNumberCounter || token.partOfSpeech === 'Chữ số' || (token.partOfSpeech && (token.partOfSpeech.includes('Lượng từ') || token.partOfSpeech.includes('Chữ số')))) badgeClass = 'badge-number';
      else if (token.isGrammar || token.isParticle || token.isAuxiliary || token.isDemonstrative) badgeClass = 'badge-grammar';
      else if (token.conjugation || (token.partOfSpeech && token.partOfSpeech.includes('Động từ'))) badgeClass = 'badge-verb';

      let posText = token.partOfSpeech || 'Từ vựng';
      if (token.conjugation) {
        posText += ` <span style="font-size: 11px; opacity: 0.85;">(${token.conjugation})</span>`;
      }

      let meaningText = token.meaning || '—';
      if (meaningText === 'Chưa có trong từ điển') {
        meaningText = '<span style="color: var(--text-secondary); font-style: italic;">Chưa có trong từ điển</span>';
      } else if (token.grammarRole && token.grammarRole !== 'Thành phần từ vựng' && !meaningText.includes(token.grammarRole)) {
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
    const dispReading = token.reading !== '—' ? token.reading : (token.baseReading || token.surface);
    modalReading.textContent = dispReading;
    if (modalRomaji) {
      modalRomaji.textContent = token.romaji ? `(${token.romaji})` : '';
    }
    modalBaseForm.textContent = token.baseForm || token.surface;

    let posFull = token.partOfSpeech || 'Từ vựng';
    if (token.conjugation) {
      posFull += ` • ${token.conjugation}`;
    }
    modalPosConj.textContent = posFull;

    // Hiển thị âm Hán Việt nếu có
    if (token.hanviet && modalHanvietSection && modalHanviet) {
      modalHanvietSection.style.display = 'block';
      modalHanviet.textContent = token.hanviet;
    } else if (modalHanvietSection) {
      modalHanvietSection.style.display = 'none';
    }

    let meanFull = token.meaning || 'Chưa có thông tin nghĩa chi tiết';
    if (token.grammarRole && token.grammarRole !== 'Thành phần từ vựng' && !meanFull.includes(token.grammarRole)) {
      meanFull += `\n• Chức năng: ${token.grammarRole}`;
    }
    modalMeaning.textContent = meanFull;

    // Reset ô chỉnh sửa nghĩa
    if (modalMeaningEdit) {
      modalMeaningEdit.value = token.meaning && token.meaning !== '—' ? token.meaning : '';
      modalMeaningEdit.style.display = 'none';
      modalMeaning.style.display = 'block';
      if (btnToggleEditMeaning) {
        btnToggleEditMeaning.textContent = '✏️ Chỉnh sửa nghĩa';
      }
    }

    // Nạp danh sách thư mục / bộ thẻ hiện có
    if (modalFolderSelect && typeof getSavedFolders === 'function') {
      getSavedFolders().then(async (folders) => {
        modalFolderSelect.innerHTML = '';
        const lastFolder = (typeof getLastSavedFolder === 'function') ? await getLastSavedFolder() : 'Mặc định';
        const folderList = Array.isArray(folders) && folders.length > 0 ? folders : ['Mặc định'];
        folderList.forEach(f => {
          const opt = document.createElement('option');
          opt.value = f;
          opt.textContent = f;
          if (f === lastFolder) opt.selected = true;
          modalFolderSelect.appendChild(opt);
        });
      }).catch(err => {
        console.warn('Lỗi nạp thư mục:', err);
      });
    }

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

  // Chuyển đổi trạng thái chỉnh sửa nghĩa
  if (btnToggleEditMeaning && modalMeaningEdit && modalMeaning) {
    btnToggleEditMeaning.addEventListener('click', () => {
      if (modalMeaningEdit.style.display === 'none') {
        modalMeaningEdit.style.display = 'block';
        modalMeaning.style.display = 'none';
        modalMeaningEdit.focus();
        btnToggleEditMeaning.textContent = '👁️ Xem nghĩa gốc';
      } else {
        modalMeaningEdit.style.display = 'none';
        modalMeaning.style.display = 'block';
        btnToggleEditMeaning.textContent = '✏️ Chỉnh sửa nghĩa';
      }
    });
  }

  // Lưu vào Flashcard
  btnModalSave.addEventListener('click', async () => {
    if (!currentActiveToken) return;
    const t = currentActiveToken;
    const selectedFolder = (modalFolderSelect && modalFolderSelect.value) ? modalFolderSelect.value : 'Mặc định';
    const editedMeaning = (modalMeaningEdit && modalMeaningEdit.value.trim()) ? modalMeaningEdit.value.trim() : '';
    const finalMeaning = editedMeaning || (t.meaning && t.meaning !== '—' ? t.meaning : 'Từ vựng tiếng Nhật');

    const vocabData = {
      kanji: t.surface,
      word: t.surface,
      reading: t.reading !== '—' ? t.reading : (t.baseReading || t.surface),
      meaningVi: finalMeaning,
      meaning: finalMeaning,
      hanviet: t.hanviet || '',
      pos: t.partOfSpeech || 'Từ vựng',
      example: (currentAnalysis && currentAnalysis.sentence) ? currentAnalysis.sentence : '',
      exampleMeaning: currentTranslationText || '',
      notes: t.conjugation ? `Chia thể: ${t.conjugation}` : '',
      source: 'sentence-analyzer',
      createdAt: new Date().toISOString()
    };

    try {
      if (typeof saveWord === 'function') {
        await saveWord(vocabData, selectedFolder);
        if (typeof setLastSavedFolder === 'function') {
          await setLastSavedFolder(selectedFolder);
        }
        showToast(`⭐ Đã lưu "${t.surface}" vào thư mục "${selectedFolder}"!`, 3000);
      } else if (typeof addWordToReview === 'function') {
        await addWordToReview(vocabData, selectedFolder);
        showToast(`⭐ Đã lưu "${t.surface}" vào ôn tập Flashcard!`, 3000);
      } else {
        showToast(`⭐ Đã ghi nhận từ "${t.surface}"`, 2500);
      }

      if (typeof broadcastDataChange === 'function') {
        broadcastDataChange('WORD_SAVED', { word: t.surface, folder: selectedFolder });
      }
    } catch (e) {
      showToast('Lỗi lưu từ: ' + e.message, 3000);
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
    cleanupLegacyAiSettings();
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
