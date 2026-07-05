// アプリのデータ管理と画面制御

// データのキー定義
const STORAGE_KEY = 'bp_tracker_data';

// 読み込み完了時の処理
document.addEventListener('DOMContentLoaded', () => {
  initDateTime();
  loadHistory();
  setupEventListeners();
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
}

// 3. データの保存
function saveData() {
  const systolicInput = document.getElementById('bp-systolic');
  const diastolicInput = document.getElementById('bp-diastolic');
  const pulseInput = document.getElementById('pulse');
  const memoInput = document.getElementById('memo');
  const dateInput = document.getElementById('input-date');
  const timeInput = document.getElementById('input-time');
  
  const systolic = parseInt(systolicInput.value);
  const diastolic = parseInt(diastolicInput.value);
  const pulse = parseInt(pulseInput.value);
  const memo = memoInput.value.trim();
  const date = dateInput.value;
  const time = timeInput.value;
  const period = document.getElementById('btn-morning').dataset.active === 'true' ? 'morning' : 'evening';
  
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
    memo
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
  loadHistory();
  updateConciergeAdvice();
  
  // フォームの一部リセット
  systolicInput.value = '';
  diastolicInput.value = '';
  pulseInput.value = '';
  memoInput.value = '';
  
  // 日時をその瞬間に更新
  initDateTime();
  
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
  
  data.forEach(item => {
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
        <div class="history-item-actions">
          <span class="status-badge ${badgeClass}">${statusLabel}</span>
          <button class="delete-btn" onclick="deleteRecord('${item.id}')" aria-label="削除">🗑️</button>
        </div>
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
      ${item.memo ? `<div class="history-item-footer"><strong>メモ:</strong> ${escapeHtml(item.memo)}</div>` : ''}
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
  
  // グラフ用にデータを古い順（時系列）にする
  // 直近14回分のデータにする
  const chartData = [...data].reverse().slice(-14);
  
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

  // キラキラ・ハートのパーティクルを動的に生成して散らす
  const colors = ['#ff6b81', '#ff4757', '#ffd43b', '#4ea8de', '#2ecc71', '#e599f7'];
  const symbols = ['♥', '★', '✨', '🌸', '🐾'];
  const particleCount = 30;

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
