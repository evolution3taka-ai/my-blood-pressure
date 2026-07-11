// アプリのデータ管理と画面制御

// データのキー定義
const STORAGE_KEY = 'bp_tracker_data';

// 読み込み完了時の処理
document.addEventListener('DOMContentLoaded', () => {
  initDateTime();
  setupEventListeners();
  fetchKaneyamaWeather(); // 会津若松市金川町の天気を自動取得
  updateMonthDropdown();
  loadHistory();
  checkPwaGuide();
  registerServiceWorker();
  updateConciergeAdvice();
});

// サービスワーカーの登録
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => {
        console.log('Service Worker 登録成功:', reg.scope);
      })
      .catch((err) => {
        console.error('Service Worker 登録失敗:', err);
      });
  }
}

// 1. 日付と時間の初期設定
function initDateTime() {
  const now = new Date();
  
  // 日付の設定 (YYYY-MM-DD)
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  document.getElementById('input-date').value = `${yyyy}-${mm}-${dd}`;
  
  // 時間の設定 (HH:MM)
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('input-time').value = `${hh}:${min}`;
  
  // 朝・夜の自動判別 (12:00 前なら朝、以降なら夜)
  const isMorning = now.getHours() < 12;
  setPeriod(isMorning ? 'morning' : 'evening');

  // 血圧・脈拍のデフォルト値を明示的にセット（古いHTMLキャッシュ対策）
  const sysInput = document.getElementById('bp-systolic');
  const diaInput = document.getElementById('bp-diastolic');
  const pulseInput = document.getElementById('pulse');
  if (sysInput && !sysInput.value) sysInput.value = '120';
  if (diaInput && !diaInput.value) diaInput.value = '70';
  if (pulseInput && !pulseInput.value) pulseInput.value = '60';
}

// 朝・夜ボタンのアクティブ切り替え
function setPeriod(period) {
  const btnMorning = document.getElementById('btn-morning');
  const btnEvening = document.getElementById('btn-evening');
  
  if (period === 'morning') {
    btnMorning.classList.add('active');
    btnEvening.classList.remove('active');
    btnMorning.dataset.active = 'true';
    btnEvening.dataset.active = 'false';
  } else {
    btnMorning.classList.remove('active');
    btnEvening.classList.add('active');
    btnMorning.dataset.active = 'false';
    btnEvening.dataset.active = 'true';
  }
}

// 2. イベントリスナーの設定
function setupEventListeners() {
  // 朝・夜ボタン
  document.getElementById('btn-morning').addEventListener('click', () => setPeriod('morning'));
  document.getElementById('btn-evening').addEventListener('click', () => setPeriod('evening'));
  
  // 記録を保存するボタン
  document.getElementById('btn-submit').addEventListener('click', saveData);
  
  // タブ切り替え（履歴 / グラフ）
  const tabHistory = document.getElementById('tab-history');
  const tabChart = document.getElementById('tab-chart');
  const secHistory = document.getElementById('section-history');
  const secChart = document.getElementById('section-chart');
  
  tabHistory.addEventListener('click', () => {
    tabHistory.classList.add('active');
    tabChart.classList.remove('active');
    secHistory.style.display = 'block';
    secChart.style.display = 'none';
  });
  
  tabChart.addEventListener('click', () => {
    tabHistory.classList.remove('active');
    tabChart.classList.add('active');
    secHistory.style.display = 'none';
    secChart.style.display = 'block';
    renderChart(); // グラフ表示時に描画
  });
  
  // バックアップ・復元エリアの表示切り替え
  const btnToggleBackup = document.getElementById('btn-toggle-backup');
  const backupArea = document.getElementById('backup-area');
  btnToggleBackup.addEventListener('click', () => {
    const isHidden = backupArea.style.display === 'none';
    backupArea.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
      prepareBackupText();
    }
  });
  
  // コピー・インポート
  document.getElementById('btn-copy-backup').addEventListener('click', copyBackupText);
  document.getElementById('btn-import-backup').addEventListener('click', importBackupData);
  
  // PWA案内ポップアップの閉じるボタン
  document.getElementById('pwa-guide-close').addEventListener('click', () => {
    document.getElementById('pwa-guide').classList.remove('show');
    localStorage.setItem('bp_pwa_guide_dismissed', 'true');
  });

  // 月選択ドロップダウンの変更イベント
  document.getElementById('select-month').addEventListener('change', () => {
    loadHistory();
    const secChart = document.getElementById('section-chart');
    if (secChart.style.display !== 'none') {
      renderChart();
    }
  });

  // レポート（医師提出用）イベント
  document.getElementById('btn-show-report').addEventListener('click', openReport);
  document.getElementById('btn-close-report').addEventListener('click', closeReport);
  document.getElementById('btn-print-report').addEventListener('click', () => {
    window.print();
  });
  document.getElementById('btn-toggle-report-chart').addEventListener('click', toggleReportChart);
}

// 3. データの保存
function saveData() {
  const systolicInput = document.getElementById('bp-systolic');
  const diastolicInput = document.getElementById('bp-diastolic');
  const pulseInput = document.getElementById('pulse');
  const memoInput = document.getElementById('memo');
  const dateInput = document.getElementById('input-date');
  const timeInput = document.getElementById('input-time');
  const weatherInput = document.getElementById('input-weather');
  const tempInput = document.getElementById('input-temp');
  
  const systolic = parseInt(systolicInput.value);
  const diastolic = parseInt(diastolicInput.value);
  const pulse = parseInt(pulseInput.value);
  const memo = memoInput.value.trim();
  const date = dateInput.value;
  const time = timeInput.value;
  const period = document.getElementById('btn-morning').dataset.active === 'true' ? 'morning' : 'evening';
  const weather = weatherInput ? weatherInput.value : 'sunny';
  const temp = tempInput ? tempInput.value : '';
  
  // 簡単なバリデーション（空チェックと数値範囲）
  if (isNaN(systolic) || isNaN(diastolic) || isNaN(pulse)) {
    alert('「最高（上）」「最低（下）」「脈拍」を数字で入力してください。');
    return;
  }
  
  if (systolic < 40 || systolic > 250 || diastolic < 30 || diastolic > 180 || pulse < 30 || pulse > 200) {
    alert('入力された数値が異常に大きいか小さいです。もう一度確認してください。');
    return;
  }

  const newRecord = {
    id: Date.now().toString(),
    date,
    time,
    period,
    systolic,
    diastolic,
    pulse,
    memo,
    weather,
    temp
  };
  
  // データの読み込みと追加
  const data = getStoredData();
  data.push(newRecord);
  
  // 日付と時間で並び替え（新しい順）
  data.sort((a, b) => {
    const dateTimeA = new Date(`${a.date}T${a.time}`);
    const dateTimeB = new Date(`${b.date}T${b.time}`);
    return dateTimeB - dateTimeA;
  });
  
  saveDataToStorage(data);
  
  // 画面の更新
  updateMonthDropdown();
  loadHistory();
  updateConciergeAdvice();
  
  // フォームの一部リセット (デフォルト値に戻す)
  systolicInput.value = '120';
  diastolicInput.value = '70';
  pulseInput.value = '60';
  memoInput.value = '';
  
  // 日時をその瞬間に更新
  initDateTime();
  
  // 天気を再自動取得
  fetchKaneyamaWeather();
  
  // 記録完了のポップアップ（ラテ先生とキラキラ）を表示
  showSuccessModal();
  
  // もしバックアップエリアが開いていたらテキスト更新
  if (document.getElementById('backup-area').style.display !== 'none') {
    prepareBackupText();
  }
}

// 4. ローカルストレージ操作ヘルパー
function getStoredData() {
  const rawData = localStorage.getItem(STORAGE_KEY);
  return rawData ? JSON.parse(rawData) : [];
}

function saveDataToStorage(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// 5. 履歴データの読み込みと描画
function loadHistory() {
  const data = getStoredData();
  const historyList = document.getElementById('history-list');
  historyList.innerHTML = '';
  
  if (data.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p>まだ血圧の記録がありません。</p>
        <p style="font-size: 14px; margin-top: 4px;">上のフォームから記録してみましょう！</p>
      </div>
    `;
    return;
  }

  // 選択された月でフィルタリング
  const selectMonth = document.getElementById('select-month');
  const selectedMonthVal = selectMonth ? selectMonth.value : 'all';
  const filteredData = selectedMonthVal === 'all' 
    ? data 
    : data.filter(item => item.date.startsWith(selectedMonthVal));

  if (filteredData.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <p>この月の記録はありません。</p>
      </div>
    `;
    return;
  }
  
  filteredData.forEach(item => {
    // 血圧値の判定（家庭血圧の基準：正常 125/80 未満、高血圧 135/85 以上）
    let statusClass = 'status-normal';
    let statusLabel = '正常';
    let badgeClass = 'bg-normal';
    
    if (item.systolic >= 135 || item.diastolic >= 85) {
      statusClass = 'status-danger';
      statusLabel = '高いよ';
      badgeClass = 'bg-danger';
    } else if ((item.systolic >= 125 && item.systolic < 135) || (item.diastolic >= 80 && item.diastolic < 85)) {
      statusClass = 'status-warning';
      statusLabel = '少し高め';
      badgeClass = 'bg-warning';
    } else {
      statusClass = 'status-normal';
      statusLabel = 'いい感じ';
      badgeClass = 'bg-normal';
    }
    
    // 日付を「月/日」に整形
    const dateObj = new Date(item.date);
    const dateStr = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    
    const icon = item.period === 'morning' ? '☀️ 朝' : '🌙 夜';
    
    const itemEl = document.createElement('div');
    itemEl.className = `history-item ${statusClass}`;
    
    itemEl.innerHTML = `
      <div class="history-item-header">
        <div class="history-item-time">
          <strong>${dateStr}</strong>
          <span>${item.time} (${icon})</span>
        </div>
        <span class="status-badge ${badgeClass}">${statusLabel}</span>
      </div>
      <div class="history-item-body">
        <div class="bp-values-display">
          <span class="bp-value-large">${item.systolic}</span>
          <span class="bp-slash">/</span>
          <span class="bp-value-large">${item.diastolic}</span>
          <span class="input-unit" style="margin-left: 6px;">mmHg</span>
        </div>
        <div class="pulse-value-display">
          脈拍 <span class="pulse-num">${item.pulse}</span>
        </div>
      </div>
      <div class="history-item-footer-container">
        <div class="history-item-memo-box">
          ${item.weather ? `<div class="history-weather-line" style="font-size: 13px; margin-bottom: 4px; font-weight: bold; color: var(--color-text-muted);">${getWeatherIcon(item.weather)}${item.temp !== undefined && item.temp !== '' ? ` ${item.temp}℃` : ''}</div>` : ''}
          ${item.memo ? `<strong>メモ:</strong> ${escapeHtml(item.memo)}` : ''}
        </div>
        <button class="delete-btn" onclick="deleteRecord('${item.id}')" aria-label="削除">🗑️ 消す</button>
      </div>
    `;
    
    historyList.appendChild(itemEl);
  });
}

// 安全なHTMLエスケープ
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// データの削除（グローバル定義してonclickで動作するようにする）
window.deleteRecord = function(id) {
  if (confirm('この記録を消してもよろしいですか？')) {
    let data = getStoredData();
    data = data.filter(item => item.id !== id);
    saveDataToStorage(data);
    updateMonthDropdown();
    loadHistory();
    updateConciergeAdvice();
    
    // グラフが表示中の場合は再描画
    const secChart = document.getElementById('section-chart');
    if (secChart.style.display !== 'none') {
      renderChart();
    }
    
    // バックアップテキスト更新
    if (document.getElementById('backup-area').style.display !== 'none') {
      prepareBackupText();
    }
  }
};



// 6. トースト通知表示
function showToast() {
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// 7. Chart.js による折れ線グラフ描画
let bpChartInstance = null;
function renderChart() {
  const ctx = document.getElementById('bpChart').getContext('2d');
  const data = getStoredData();
  
  if (data.length === 0) {
    if (bpChartInstance) {
      bpChartInstance.destroy();
      bpChartInstance = null;
    }
    ctx.font = '16px Noto Sans JP';
    ctx.textAlign = 'center';
    ctx.fillText('データが登録されるとここにグラフが表示されます。', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  // 選択された月でフィルタリング
  const selectMonth = document.getElementById('select-month');
  const selectedMonthVal = selectMonth ? selectMonth.value : 'all';
  const filteredData = selectedMonthVal === 'all' 
    ? data 
    : data.filter(item => item.date.startsWith(selectedMonthVal));

  if (filteredData.length === 0) {
    if (bpChartInstance) {
      bpChartInstance.destroy();
      bpChartInstance = null;
    }
    // グラフキャンバスをクリアしてテキスト表示
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = '16px Noto Sans JP';
    ctx.fillStyle = '#7f8c8d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('この月のデータはありません。', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }
  
  // グラフ用にデータを古い順（時系列）にする
  // 「すべて」の場合は直近14回分、特定の月の場合はその月の全データ（最大31回分）にする
  const limit = selectedMonthVal === 'all' ? 14 : 31;
  const chartData = [...filteredData].reverse().slice(-limit);
  
  const labels = chartData.map(item => {
    const d = new Date(item.date);
    const p = item.period === 'morning' ? '朝' : '夜';
    return `${d.getMonth() + 1}/${d.getDate()}(${p})`;
  });
  
  const systolicData = chartData.map(item => item.systolic);
  const diastolicData = chartData.map(item => item.diastolic);
  const pulseData = chartData.map(item => item.pulse);
  
  if (bpChartInstance) {
    bpChartInstance.destroy();
  }
  
  bpChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '最高血圧 (上)',
          data: systolicData,
          borderColor: '#ff6b81',
          backgroundColor: '#ff6b81',
          borderWidth: 4,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.15,
          yAxisID: 'y'
        },
        {
          label: '最低血圧 (下)',
          data: diastolicData,
          borderColor: '#4ea8de',
          backgroundColor: '#4ea8de',
          borderWidth: 4,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0.15,
          yAxisID: 'y'
        },
        {
          label: '脈拍',
          data: pulseData,
          borderColor: '#2ecc71',
          backgroundColor: 'rgba(46, 204, 113, 0.2)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 4,
          tension: 0.15,
          yAxisID: 'yPulse',
          hidden: true // 最初はスッキリさせるために非表示にしておき、凡例タップで出せるようにする
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: {
              family: 'Noto Sans JP',
              size: 14,
              weight: 'bold'
            },
            color: '#2c3e50'
          }
        },
        tooltip: {
          titleFont: { family: 'Noto Sans JP', size: 14 },
          bodyFont: { family: 'Noto Sans JP', size: 14 }
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          min: 40,
          max: 200,
          title: {
            display: true,
            text: '血圧 (mmHg)',
            font: { family: 'Noto Sans JP', size: 12, weight: 'bold' }
          },
          ticks: {
            font: { family: 'Noto Sans JP', size: 12 }
          }
        },
        yPulse: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 40,
          max: 120,
          grid: {
            drawOnChartArea: false // 脈拍用グリッド線を隠して重なりを防ぐ
          },
          title: {
            display: true,
            text: '脈拍 (拍/分)',
            font: { family: 'Noto Sans JP', size: 12, weight: 'bold' }
          },
          ticks: {
            font: { family: 'Noto Sans JP', size: 12 }
          }
        },
        x: {
          ticks: {
            font: { family: 'Noto Sans JP', size: 11 },
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    }
  });
}

// 8. バックアップ機能
function prepareBackupText() {
  const data = getStoredData();
  const textarea = document.getElementById('textarea-backup');
  if (data.length === 0) {
    textarea.value = '';
    return;
  }
  // おばちゃんがコピーしやすいよう、単なるJSONではなくBase64文字列にエンコードして簡単な英数字の文字列にする
  try {
    const jsonStr = JSON.stringify(data);
    // UTF-8対応のBase64エンコード
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    const len = utf8Bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const base64 = btoa(binary);
    textarea.value = base64;
  } catch (e) {
    console.error(e);
    textarea.value = JSON.stringify(data);
  }
}

function copyBackupText() {
  const textarea = document.getElementById('textarea-backup');
  if (!textarea.value) {
    alert('保存するデータがありません。');
    return;
  }
  
  textarea.select();
  textarea.setSelectionRange(0, 99999); // スマホ対応
  
  try {
    navigator.clipboard.writeText(textarea.value).then(() => {
      alert('コピーしました！LINEやメールの下書きなどに貼り付けて保存してください。');
    }).catch(() => {
      // クリップボードAPIが使えなかった場合の代替
      document.execCommand('copy');
      alert('コピーしました！');
    });
  } catch (err) {
    alert('コピーに失敗しました。文字枠を長押しして手動でコピーしてください。');
  }
}

function importBackupData() {
  const rawInput = prompt('保存しておいたバックアップ文字をここに貼り付けてください（貼り付け後、「OK」を押します）：');
  if (!rawInput) return;
  
  try {
    let jsonStr = '';
    // Base64デコードを試みる
    try {
      const decodedBinary = atob(rawInput.trim());
      const bytes = new Uint8Array(decodedBinary.length);
      for (let i = 0; i < decodedBinary.length; i++) {
        bytes[i] = decodedBinary.charCodeAt(i);
      }
      jsonStr = new TextDecoder().decode(bytes);
    } catch (e) {
      // デコードに失敗した場合は直接JSONとして扱ってみる
      jsonStr = rawInput.trim();
    }
    
    const parsedData = JSON.parse(jsonStr);
    
    // 簡単な配列チェック
    if (!Array.isArray(parsedData)) {
      throw new Error('データ形式が正しくありません');
    }
    
    if (confirm('データを読み込みます。現在記録されているデータは上書きされ、消えてしまいますが、よろしいですか？')) {
      saveDataToStorage(parsedData);
      updateMonthDropdown();
      loadHistory();
      initDateTime();
      updateConciergeAdvice();
      
      // グラフ再描画
      const secChart = document.getElementById('section-chart');
      if (secChart.style.display !== 'none') {
        renderChart();
      }
      
      // バックアップ文字列再生成
      prepareBackupText();
      
      alert('読み込みが完了しました！');
    }
  } catch (err) {
    alert('データの読み込みに失敗しました。正しい文字が貼り付けられているか確認してください。');
  }
}

// 9. PWAインストールの案内表示
function checkPwaGuide() {
  // すでにPWAとして起動しているか、または過去に閉じた場合は表示しない
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  const isDismissed = localStorage.getItem('bp_pwa_guide_dismissed') === 'true';
  
  if (isStandalone || isDismissed) {
    return;
  }
  
  const userAgent = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  
  const guide = document.getElementById('pwa-guide');
  const guideIos = document.getElementById('guide-ios');
  const guideAndroid = document.getElementById('guide-android');
  const guideOther = document.getElementById('guide-other');
  
  if (isIos) {
    guideIos.style.display = 'block';
    guideOther.style.display = 'none';
  } else if (isAndroid) {
    guideAndroid.style.display = 'block';
    guideOther.style.display = 'none';
  }
  
  // 3秒後にスライド表示
  setTimeout(() => {
    guide.classList.add('show');
  }, 3000);
}

// 10. コンシェルジュ（ラテ先生）の診断・アドバイスロジック
function updateConciergeAdvice() {
  const data = getStoredData();
  const adviceEl = document.getElementById('concierge-advice');
  const avatarEl = document.getElementById('concierge-avatar');
  if (!adviceEl || !avatarEl) return;
  
  if (data.length === 0) {
    avatarEl.src = 'latte_cheer.jpg';
    adviceEl.textContent = '今日もお疲れ様！血圧を測ったら、下のフォームに書いて教えてね。ラテ先生がいつでも待ってるよ！🐩';
    return;
  }
  
  if (data.length < 3) {
    avatarEl.src = 'latte_cheer.jpg';
    adviceEl.textContent = '記録してくれてありがとう！まずは3日間、朝と夜に続けて測ってみようね。三日坊主にならないよう応援してるよ！🐾';
    return;
  }
  
  // 直近5件の平均血圧を計算
  const recentRecords = data.slice(0, 5);
  let sumSystolic = 0;
  let sumDiastolic = 0;
  let validCount = 0;
  
  recentRecords.forEach(r => {
    const sys = parseInt(r.systolic);
    const dia = parseInt(r.diastolic);
    if (!isNaN(sys) && !isNaN(dia)) {
      sumSystolic += sys;
      sumDiastolic += dia;
      validCount++;
    }
  });
  
  // 有効なデータがなければ終了
  if (validCount === 0) {
    avatarEl.src = 'latte_cheer.jpg';
    adviceEl.textContent = '血圧を記録して教えてね！ラテ先生がアドバイスするよ🐩';
    return;
  }
  
  const avgSys = Math.round(sumSystolic / validCount);
  const avgDia = Math.round(sumDiastolic / validCount);
  
  let adviceText = '';
  let avatarSrc = 'concierge.jpg'; // デフォルト笑顔
  
  // 診断のバリエーション（8段階）
  if (avgSys >= 160 || avgDia >= 100) {
    // 非常に高い
    avatarSrc = 'latte_alert.jpg';
    adviceText = '血圧がかなり高い状態だよ。急激な運動は控えて、部屋を暖かくして静かに過ごしてね。頭痛やめまいがあるときは、お医者さんに相談してね🩺';
  } else if (avgSys >= 135 || avgDia >= 85) {
    // I度高血圧（高い）
    avatarSrc = 'latte_alert.jpg';
    adviceText = '最近の血圧は、少し高めの状態が続いているみたい。暖かくしてゆっくり休んでね。お風呂はぬるめのお湯にゆっくり浸かろう🛀';
  } else if (avgSys >= 130 || avgDia >= 80) {
    // 高値血圧（少し高い）
    avatarSrc = 'latte_worried.jpg';
    adviceText = '最近ちょっとだけ血圧が高い日があるみたい。お味噌汁の汁を残したり、お漬物を少し減らして減塩を意識してみようね🍵';
  } else if (avgSys >= 120) {
    // 正常高値（少し高め・正常内）
    avatarSrc = 'concierge.jpg';
    adviceText = '少し血圧が高めだけど、まだ正常の範囲内だよ。軽いストレッチをしたり、野菜を多めに食べるのを意識してみてね🥦';
  } else {
    // 正常（良い）
    avatarSrc = 'concierge.jpg';
    adviceText = '血圧はばっちり正常範囲内！とっても健康的だよ。素晴らしい！この調子で毎日元気に過ごしてね🌟';
  }
  
  // 追加アドバイス：朝と夜の血圧差チェック (早朝高血圧傾向)
  const morningRecords = data.filter(r => r.period === 'morning' && !isNaN(parseInt(r.systolic)));
  const eveningRecords = data.filter(r => r.period === 'evening' && !isNaN(parseInt(r.systolic)));
  
  if (morningRecords.length >= 2 && eveningRecords.length >= 2) {
    const morningCount = Math.min(morningRecords.length, 3);
    const eveningCount = Math.min(eveningRecords.length, 3);
    
    const sumMorningSys = morningRecords.slice(0, morningCount).reduce((sum, r) => sum + parseInt(r.systolic), 0);
    const avgMorningSys = sumMorningSys / morningCount;
    
    const sumEveningSys = eveningRecords.slice(0, eveningCount).reduce((sum, r) => sum + parseInt(r.systolic), 0);
    const avgEveningSys = sumEveningSys / eveningCount;
    
    // 朝が夜より 15 以上高い場合
    if (avgMorningSys - avgEveningSys >= 15) {
      adviceText += '（★朝の血圧が夜より高くなりやすいみたい。朝起きたらお布団の中で手足をグーパー動かしてから、ゆっくり起き上がるといいよ！🐶）';
    }
  }
  
  // 追加アドバイス：脈拍平均チェック
  let sumPulse = 0;
  let pulseCount = 0;
  recentRecords.forEach(r => {
    const p = parseInt(r.pulse);
    if (!isNaN(p)) {
      sumPulse += p;
      pulseCount++;
    }
  });
  
  if (pulseCount > 0) {
    const avgPulse = Math.round(sumPulse / pulseCount);
    if (avgPulse >= 90) {
      adviceText += ' 最近少し脈拍が早い日があるみたい。ゆっくり深呼吸を3回して、リラックスして過ごしてね🐾';
    } else if (avgPulse <= 55) {
      adviceText += ' 脈拍が少しゆっくりめみたい。体が冷えていないかな？温かい生姜湯などを飲んで温まってね☕️';
    }
  }
  
  avatarEl.src = avatarSrc;
  adviceEl.textContent = adviceText;
}

// 11. 記録完了ポップアップ（アニメーション）の制御
function showSuccessModal() {
  const modal = document.getElementById('success-modal');
  const particlesContainer = document.getElementById('success-particles');
  if (!modal || !particlesContainer) return;

  // 以前のパーティクルをクリア
  particlesContainer.innerHTML = '';

  // キラキラ・ハートのパーティクルを動的に生成して散らす（数を増やし、より華やかに）
  const colors = ['#ff6b81', '#ff4757', '#ffd43b', '#4ea8de', '#2ecc71', '#ff922b', '#da77f2'];
  const symbols = ['♥', '★', '✨', '🌸', '🐾', '🎉', '🌟', '💮', '🍀'];
  const particleCount = 65;

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    p.style.color = colors[Math.floor(Math.random() * colors.length)];
    
    // ランダムな方向と距離
    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 150;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 50; // 少し上に吹き飛ばす
    
    // アニメーション用のCSSカスタムプロパティをセット
    p.style.setProperty('--dx', `${dx}px`);
    p.style.setProperty('--dy', `${dy}px`);
    p.style.setProperty('--scale', 0.5 + Math.random() * 1.2);
    p.style.setProperty('--rot', `${Math.random() * 360 - 180}deg`);
    
    // 初期配置位置のブレ
    p.style.left = `${Math.random() * 20 - 10}px`;
    p.style.top = `${Math.random() * 20 - 10}px`;
    
    // ディレイを付けてバラバラに飛ばす
    p.style.animationDelay = `${Math.random() * 0.2}s`;

    particlesContainer.appendChild(p);
  }

  // モーダルを表示
  modal.classList.add('show');

  // 1.8秒後に自動で閉じる
  setTimeout(() => {
    modal.classList.remove('show');
  }, 1800);
}

// 12. 月選択ドロップダウンの動的生成
function updateMonthDropdown() {
  const selectMonth = document.getElementById('select-month');
  if (!selectMonth) return;
  
  // 現在選択されている値を記憶
  const prevValue = selectMonth.value || 'all';
  
  const data = getStoredData();
  
  // 重複しない年月(YYYY-MM)を抽出
  const monthsSet = new Set();
  data.forEach(item => {
    if (item.date && item.date.length >= 7) {
      monthsSet.add(item.date.substring(0, 7));
    }
  });
  
  // 配列化して降順（新しい順）に並び替え
  const sortedMonths = Array.from(monthsSet).sort().reverse();
  
  // 選択肢のクリア
  selectMonth.innerHTML = '<option value="all">すべての月を表示</option>';
  
  // 選択肢の追加
  sortedMonths.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    // 表示用のフォーマット "YYYY年MM月"
    const parts = m.split('-');
    opt.textContent = `${parts[0]}年${parseInt(parts[1])}月`;
    selectMonth.appendChild(opt);
  });
  
  // 選択されていた値を復元（なければ 'all'）
  const hasPrevValue = sortedMonths.includes(prevValue);
  selectMonth.value = hasPrevValue ? prevValue : 'all';
}

// 13. 医師提出用レポート（1枚シート）の制御
function openReport() {
  generateReport();
  document.getElementById('report-modal').classList.add('show');
}

function closeReport() {
  document.getElementById('report-modal').classList.remove('show');
  
  // レポート用グラフコンテナと表示ステートのリセット
  const container = document.getElementById('report-chart-container');
  if (container) container.style.display = 'none';
  
  const btn = document.getElementById('btn-toggle-report-chart');
  if (btn) btn.textContent = '📈 グラフを表示する';
  
  if (reportChartInstance) {
    reportChartInstance.destroy();
    reportChartInstance = null;
  }
}

function generateReport() {
  const data = getStoredData();
  const tableBody = document.getElementById('report-table-body');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  // 現在選択されている月を取得してフィルタリング
  const selectMonth = document.getElementById('select-month');
  const selectedMonthVal = selectMonth ? selectMonth.value : 'all';
  const filteredData = selectedMonthVal === 'all' 
    ? data 
    : data.filter(item => item.date.startsWith(selectedMonthVal));
    
  // 期間ラベルの更新
  const monthLabel = document.getElementById('report-month-label');
  if (monthLabel) {
    if (selectedMonthVal === 'all') {
      monthLabel.textContent = '期間: すべての記録';
    } else {
      const parts = selectedMonthVal.split('-');
      monthLabel.textContent = `期間: ${parts[0]}年${parseInt(parts[1])}月`;
    }
  }
  
  // 1. 日付ごとにデータをグループ化
  // 形式: { "2026-07-06": { morning: item, evening: item } }
  const grouped = {};
  filteredData.forEach(item => {
    const d = item.date; // "YYYY-MM-DD"
    if (!grouped[d]) {
      grouped[d] = { morning: null, evening: null };
    }
    if (item.period === 'morning') {
      grouped[d].morning = item;
    } else if (item.period === 'evening') {
      grouped[d].evening = item;
    }
  });
  
  // 2. 日付を古い順（昇順）にソート
  const sortedDates = Object.keys(grouped).sort();
  
  // 平均値算出用の変数
  let sumSysMorning = 0, sumDiaMorning = 0, sumPulseMorning = 0, countMorning = 0;
  let sumSysEvening = 0, sumDiaEvening = 0, sumPulseEvening = 0, countEvening = 0;
  
  // 3. 表の行を生成
  if (sortedDates.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" style="padding: 24px; color: #64748b;">データがありません。上のフォームから記録してください。</td></tr>`;
    
    // サマリー表示をリセット
    document.getElementById('report-avg-morning').innerHTML = `- / - <span class="summary-unit">mmHg</span>`;
    document.getElementById('report-pulse-morning').textContent = '平均脈拍: -';
    document.getElementById('report-avg-evening').innerHTML = `- / - <span class="summary-unit">mmHg</span>`;
    document.getElementById('report-pulse-evening').textContent = '平均脈拍: -';
    document.getElementById('report-total-days').innerHTML = `0 <span class="summary-unit">日</span>`;
    return;
  }
  
  sortedDates.forEach(dateStr => {
    const day = grouped[dateStr];
    const m = day.morning;
    const e = day.evening;
    
    // 日付表示を "M月D日(曜日)" に整形
    const dateObj = new Date(dateStr);
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
    const displayDate = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日(${dayOfWeek})`;
    
    // 朝のセル作成
    let morningHtml = '-';
    if (m) {
      let sysClass = '';
      if (m.systolic >= 135) sysClass = 'report-danger-text';
      else if (m.systolic >= 125) sysClass = 'report-warning-text';
      
      let diaClass = '';
      if (m.diastolic >= 85) diaClass = 'report-danger-text';
      else if (m.diastolic >= 80) diaClass = 'report-warning-text';
      
      morningHtml = `<span class="${sysClass}">${m.systolic}</span>/<span class="${diaClass}">${m.diastolic}</span> <span style="font-size:13px; color:#64748b;">(${m.pulse})</span>`;
      
      // 平均用集計
      sumSysMorning += m.systolic;
      sumDiaMorning += m.diastolic;
      sumPulseMorning += m.pulse;
      countMorning++;
    }
    
    // 夜のセル作成
    let eveningHtml = '-';
    if (e) {
      let sysClass = '';
      if (e.systolic >= 135) sysClass = 'report-danger-text';
      else if (e.systolic >= 125) sysClass = 'report-warning-text';
      
      let diaClass = '';
      if (e.diastolic >= 85) diaClass = 'report-danger-text';
      else if (e.diastolic >= 80) diaClass = 'report-warning-text';
      
      eveningHtml = `<span class="${sysClass}">${e.systolic}</span>/<span class="${diaClass}">${e.diastolic}</span> <span style="font-size:13px; color:#64748b;">(${e.pulse})</span>`;
      
      // 平均用集計
      sumSysEvening += e.systolic;
      sumDiaEvening += e.diastolic;
      sumPulseEvening += e.pulse;
      countEvening++;
    }
    
    // メモの結合 (天気情報もさりげなく挿入)
    let memoText = '';
    
    // 朝の天気
    let mWeatherText = '';
    if (m && m.weather) {
      const wIcon = getWeatherIcon(m.weather);
      const tText = m.temp !== undefined && m.temp !== '' ? `${m.temp}℃` : '';
      mWeatherText = `<span style="font-size: 13px;">${wIcon} ${tText}</span>`;
    }
    
    // 夜の天気
    let eWeatherText = '';
    if (e && e.weather) {
      const wIcon = getWeatherIcon(e.weather);
      const tText = e.temp !== undefined && e.temp !== '' ? `${e.temp}℃` : '';
      eWeatherText = `<span style="font-size: 13px;">${wIcon} ${tText}</span>`;
    }

    if (m) {
      const mMemo = m.memo ? escapeHtml(m.memo) : '';
      const wText = mWeatherText ? `${mWeatherText}` : '';
      if (wText || mMemo) {
        memoText += `朝: ${wText}${wText && mMemo ? ' | ' : ''}${mMemo}`;
      }
    }
    
    if (e) {
      const eMemo = e.memo ? escapeHtml(e.memo) : '';
      const wText = eWeatherText ? `${eWeatherText}` : '';
      if (wText || eMemo) {
        if (memoText) memoText += '<br>';
        memoText += `夜: ${wText}${wText && eMemo ? ' | ' : ''}${eMemo}`;
      }
    }
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${displayDate}</strong></td>
      <td>${morningHtml}</td>
      <td>${eveningHtml}</td>
      <td style="text-align: left; max-width: 250px;">${memoText || '-'}</td>
    `;
    tableBody.appendChild(tr);
  });
  
  // 4. 平均値と記録日数のサマリー更新
  // 朝平均
  if (countMorning > 0) {
    const avgSys = Math.round(sumSysMorning / countMorning);
    const avgDia = Math.round(sumDiaMorning / countMorning);
    const avgPulse = Math.round(sumPulseMorning / countMorning);
    
    let sysClass = avgSys >= 135 ? 'report-danger-text' : (avgSys >= 125 ? 'report-warning-text' : '');
    let diaClass = avgDia >= 85 ? 'report-danger-text' : (avgDia >= 80 ? 'report-warning-text' : '');
    
    document.getElementById('report-avg-morning').innerHTML = `<span class="${sysClass}">${avgSys}</span>/<span class="${diaClass}">${avgDia}</span> <span class="summary-unit">mmHg</span>`;
    document.getElementById('report-pulse-morning').textContent = `平均脈拍: ${avgPulse} 拍/分`;
  } else {
    document.getElementById('report-avg-morning').innerHTML = `- / - <span class="summary-unit">mmHg</span>`;
    document.getElementById('report-pulse-morning').textContent = '平均脈拍: -';
  }
  
  // 夜平均
  if (countEvening > 0) {
    const avgSys = Math.round(sumSysEvening / countEvening);
    const avgDia = Math.round(sumDiaEvening / countEvening);
    const avgPulse = Math.round(sumPulseEvening / countEvening);
    
    let sysClass = avgSys >= 135 ? 'report-danger-text' : (avgSys >= 125 ? 'report-warning-text' : '');
    let diaClass = avgDia >= 85 ? 'report-danger-text' : (avgDia >= 80 ? 'report-warning-text' : '');
    
    document.getElementById('report-avg-evening').innerHTML = `<span class="${sysClass}">${avgSys}</span>/<span class="${diaClass}">${avgDia}</span> <span class="summary-unit">mmHg</span>`;
    document.getElementById('report-pulse-evening').textContent = `平均脈拍: ${avgPulse} 拍/分`;
  } else {
    document.getElementById('report-avg-evening').innerHTML = `- / - <span class="summary-unit">mmHg</span>`;
    document.getElementById('report-pulse-evening').textContent = '平均脈拍: -';
  }
  
  // 記録日数 (ユニークな測定日)
  document.getElementById('report-total-days').innerHTML = `${sortedDates.length} <span class="summary-unit">日</span>`;
}

// 14. レポート用グラフの制御と描画
let reportChartInstance = null;
function toggleReportChart() {
  const container = document.getElementById('report-chart-container');
  const btn = document.getElementById('btn-toggle-report-chart');
  if (!container || !btn) return;
  
  const isHidden = container.style.display === 'none';
  if (isHidden) {
    container.style.display = 'block';
    btn.textContent = '📉 グラフを隠す';
    renderReportChart();
  } else {
    container.style.display = 'none';
    btn.textContent = '📈 グラフを表示する';
    if (reportChartInstance) {
      reportChartInstance.destroy();
      reportChartInstance = null;
    }
  }
}

function renderReportChart() {
  const ctx = document.getElementById('reportBpChart').getContext('2d');
  const data = getStoredData();
  
  // 現在選択されている月を取得してフィルタリング
  const selectMonth = document.getElementById('select-month');
  const selectedMonthVal = selectMonth ? selectMonth.value : 'all';
  const filteredData = selectedMonthVal === 'all' 
    ? data 
    : data.filter(item => item.date.startsWith(selectedMonthVal));
    
  if (filteredData.length === 0) {
    if (reportChartInstance) {
      reportChartInstance.destroy();
      reportChartInstance = null;
    }
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = '16px Noto Sans JP';
    ctx.fillStyle = '#7f8c8d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('この月のデータはありません。', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }
  
  // レポート用にデータを古い順にする
  // 31日分（最大）プロットする
  const chartData = [...filteredData].reverse();
  
  const labels = chartData.map(item => {
    const d = new Date(item.date);
    const p = item.period === 'morning' ? '朝' : '夜';
    return `${d.getMonth() + 1}/${d.getDate()}(${p})`;
  });
  
  const systolicData = chartData.map(item => item.systolic);
  const diastolicData = chartData.map(item => item.diastolic);
  const pulseData = chartData.map(item => item.pulse);
  
  if (reportChartInstance) {
    reportChartInstance.destroy();
  }
  
  // メイングラフと同じく美しいテーマで作成
  reportChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '最高血圧 (上)',
          data: systolicData,
          borderColor: '#ff4757',
          backgroundColor: 'rgba(255, 71, 87, 0.05)',
          borderWidth: 3,
          tension: 0.25,
          pointBackgroundColor: '#ff4757',
          pointRadius: 4
        },
        {
          label: '最低血圧 (下)',
          data: diastolicData,
          borderColor: '#2ecc71',
          backgroundColor: 'rgba(46, 204, 113, 0.05)',
          borderWidth: 3,
          tension: 0.25,
          pointBackgroundColor: '#2ecc71',
          pointRadius: 4
        },
        {
          label: '脈拍',
          data: pulseData,
          borderColor: '#4ea8de',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.25,
          pointBackgroundColor: '#4ea8de',
          pointRadius: 3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 12, weight: 'bold' }
          }
        }
      },
      scales: {
        y: {
          title: { display: true, text: '血圧 (mmHg)', font: { weight: 'bold' } },
          min: 40,
          max: 200,
          ticks: { stepSize: 20 }
        },
        y1: {
          title: { display: true, text: '脈拍 (拍/分)', font: { weight: 'bold' } },
          position: 'right',
          min: 40,
          max: 120,
          ticks: { stepSize: 20 },
          grid: { drawOnChartArea: false } // 右目盛りのグリッド線は消す
        }
      }
    }
  });
}

// 16. 数値のプラス・マイナス調整 (ステッパー)
window.stepValue = function(id, diff) {
  const input = document.getElementById(id);
  if (!input) return;
  
  let val = parseInt(input.value);
  // 値が空、NaN、または0以下の場合はデフォルト値からスタートする
  if (isNaN(val) || val <= 0 || input.value.trim() === '') {
    if (id === 'bp-systolic') val = 120;
    else if (id === 'bp-diastolic') val = 70;
    else if (id === 'pulse') val = 60;
  } else {
    val += diff;
  }
  
  // 境界チェック (HTMLのmin, max設定に準拠)
  const min = parseInt(input.min) || 30;
  const max = parseInt(input.max) || 250;
  if (val < min) val = min;
  if (val > max) val = max;
  
  input.value = val;
};

// 17. 会津若松市金川町の天気自動取得
async function fetchKaneyamaWeather() {
  const display = document.getElementById('header-weather-display');
  if (!display) return;
  
  // 会津若松市金川町の緯度経度
  const lat = 37.502;
  const lon = 139.943;
  
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=Asia%2FTokyo`);
    if (!response.ok) throw new Error('APIエラー');
    const data = await response.json();
    
    if (data && data.current_weather) {
      const code = data.current_weather.weathercode;
      const temp = Math.round(data.current_weather.temperature);
      
      // 天気コードのマッピング
      let weatherCode = 'sunny';
      if (code === 0) weatherCode = 'sunny';
      else if (code >= 1 && code <= 3) weatherCode = 'cloudy';
      else if (code >= 45 && code <= 48) weatherCode = 'cloudy';
      else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) weatherCode = 'rainy';
      else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) weatherCode = 'snowy';
      
      // 隠しフィールドの更新
      document.getElementById('input-weather').value = weatherCode;
      document.getElementById('input-temp').value = temp;
      
      // 画面表示更新（アイコンのみ ＋ 気温）
      const wIcon = getWeatherIcon(weatherCode);
      display.textContent = `${wIcon} ${temp}℃`;
      display.title = `会津若松市金川町の天気: ${wIcon} ${temp}℃`;
    }
  } catch (err) {
    console.error('天気取得エラー:', err);
    // エラー時は非表示
    display.textContent = '';
  }
}

// お天気コードを対応する絵文字アイコンに変換するヘルパー
function getWeatherIcon(code) {
  if (code === 'sunny') return '☀️';
  if (code === 'cloudy') return '☁️';
  if (code === 'rainy') return '☔';
  if (code === 'snowy') return '⛄';
  return '☀️';
}
