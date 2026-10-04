/* =====================================================================
   ЧАСТЬ 1. СМЕНА ШРИФТА ЗАПИСИ
   ===================================================================== */

const fonts = [
  "'Hachi Maru Pop', cursive",
  "'Neucha', cursive",
  "'Pangolin', cursive"
];

// Номер текущего шрифта в списке. let — потому что значение будет меняться.
let current = 0;

// Находим элементы на странице:
const fontBtn = document.getElementById('font-btn');
const entry = document.querySelector('.entry');

fontBtn.addEventListener('click', () => {
  current = (current + 1) % fonts.length;
  entry.style.fontFamily = fonts[current];
  fontBtn.style.fontFamily = fonts[current];
});

/* =====================================================================
   ЧАСТЬ 2. ТЕМА: СВЕТЛАЯ ДНЁМ, ТЁМНАЯ ПОСЛЕ ЗАКАТА + РУЧНОЙ ВЫБОР

   Логика:
   1. Если посетитель уже переключал тему в этой вкладке — оставляем его выбор.
   2. Иначе сразу ставим тему по часам.
   3. Затем узнаём точное время восхода и заката у погодного сервиса
      и, если нужно, поправляем тему.
   4. Нажатие кнопки меняет тему и запоминает выбор до закрытия вкладки.
   ===================================================================== */

// Координаты места, для которого считаем восход и закат.
const LAT = 55.45;   // широта
const LON = 37.37;   // долгота

const themeBtn = document.getElementById('theme-btn');

// Вся смена цветов происходит в CSS — здесь мы только меняем атрибут.
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'
  );
}

// Запасной вариант: грубая оценка по часам на компьютере посетителя.
function themeByHour() {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 19 ? 'light' : 'dark';
}

// Точный вариант: спрашиваем время восхода и заката у сервиса Open-Meteo.
// async — функция работает с ожиданием (запрос по сети занимает время).
// Она возвращает не сразу результат, а «обещание» (Promise) результата.
async function themeBySun() {
  //   daily=sunrise,sunset — нужны только восход и закат;
  //   timezone=auto        — сервис сам определит часовой пояс по координатам;
  //   timeformat=unixtime  — время в секундах с 1970 года, удобно сравнивать числами;
  //   forecast_days=1      — только сегодняшний день.
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
              `&daily=sunrise,sunset&timezone=auto&timeformat=unixtime&forecast_days=1`;

  const response = await fetch(url);

  if (!response.ok) throw new Error('Сервер погоды не ответил');

  // Превращаем ответ из текста в объект JavaScript.
  const data = await response.json();

  // Date.now() даёт миллисекунды с 1970 года; делим на 1000, чтобы получить секунды,
  // как у сервиса.
  const now = Date.now() / 1000;

  // Сервис возвращает массивы по дням. Мы просили один день, поэтому берём элемент [0].
  const sunrise = data.daily.sunrise[0];
  const sunset = data.daily.sunset[0];
  return now >= sunrise && now < sunset ? 'light' : 'dark';
}

// Главная функция: выбирает тему при открытии страницы.
async function initTheme() {
  // sessionStorage — небольшое хранилище браузера, которое живёт, пока открыта вкладка.
  // Если посетитель уже нажимал кнопку темы, там лежит его выбор.
  const saved = sessionStorage.getItem('theme');
  if (saved) {
    applyTheme(saved);
    return;  // return завершает функцию: дальше ничего проверять не нужно
  }

  // Сразу ставим примерную тему, не дожидаясь сервера.
  // Без этого ночью страница сначала показалась бы светлой, а потом «мигнула» в тёмную.
  applyTheme(themeByHour());

  // try/catch: пробуем выполнить код в try; если где-то внутри случится ошибка
  // (нет интернета, сервер недоступен), выполнится catch, и сайт не сломается.
  try {
    const theme = await themeBySun();

    // Пока мы ждали ответа, посетитель мог успеть нажать кнопку.
    // Проверяем ещё раз, чтобы ответ сервера не перебил его выбор.
    if (!sessionStorage.getItem('theme')) {
      applyTheme(theme);
    }
  } catch (error) {
    // console.warn пишет предупреждение в консоль разработчика (F12 → Console).
    // Посетитель его не видит, а тема просто остаётся выбранной по часам.
    console.warn('Не удалось узнать время заката, тема выбрана по часам', error);
  }
}

// Ручное переключение темы кнопкой.
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);

  // Запоминаем выбор до закрытия вкладки. После закрытия sessionStorage очищается,
  // и при следующем заходе тема снова выберется по времени.
  sessionStorage.setItem('theme', next);
});

// Запускаем выбор темы при загрузке страницы.
initTheme();


/* =====================================================================
   ЧАСТЬ 3. РЕДАКТИРОВАНИЕ ЗАПИСИ ПРЯМО НА СТРАНИЦЕ

   Логика:
   1. Нажали перо — текст становится редактируемым (contenteditable),
      курсор встаёт в конец текста, а вместо пера появляются галочка и крестик.
      Перед этим запоминаем текст «как было».
   2. Галочка (или Ctrl+Enter) — сохраняем текст в localStorage и выходим.
      localStorage, в отличие от sessionStorage, НЕ очищается при закрытии вкладки.
   3. Крестик (или Esc) — возвращаем текст «как было» и выходим.
   4. При следующем открытии страницы сохранённый текст подставляется обратно.
   ===================================================================== */

const editBtn = document.getElementById('edit-btn');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const entryBody = document.querySelector('.entry-body');

// Ключ, под которым текст лежит в localStorage. Когда появятся «День 2», «День 3»,
// у каждой записи будет свой ключ.
const STORAGE_KEY = 'entry-day-1';

// Здесь храним текст на момент начала редактирования — для кнопки «отменить».
let textBeforeEdit = '';

// Если текст уже сохраняли — подставляем его вместо исходного из HTML.
// innerHTML — это HTML-код внутри элемента (вместе с тегами <p>).
// Здесь это безопасно: в хранилище лежит только то, что этот же человек
// сам написал в своём браузере. Если когда-нибудь текст будет приходить
// от других людей, его нужно будет «очищать» (например, библиотекой DOMPurify).
const savedText = localStorage.getItem(STORAGE_KEY);
if (savedText !== null) {
  entryBody.innerHTML = savedText;
}


// Selection — то, что сейчас выделено на странице (или где стоит курсор),
// Range — участок текста. Пустой участок в конце = курсор в конце.
function placeCaretAtEnd(element) {
  const target = element.lastElementChild ?? element;

  const range = document.createRange();
  range.selectNodeContents(target);  // участок = всё содержимое абзаца
  range.collapse(false);             

  const selection = window.getSelection();
  selection.removeAllRanges();       // убираем старое выделение, если было
  selection.addRange(range);         // ставим курсор в нашу точку
}

function showEditButtons(editing) {
  editBtn.hidden = editing;
  saveBtn.hidden = !editing;
  cancelBtn.hidden = !editing;
}

// Вход в режим редактирования (перо).
function startEditing() {
  textBeforeEdit = entryBody.innerHTML;  // запоминаем, «как было»
  entryBody.contentEditable = 'true';
  showEditButtons(true);

  entryBody.focus();           // переводим фокус в текст
  placeCaretAtEnd(entryBody);  // и ставим курсор в конец
}

// Общий выход из режима — его используют и «сохранить», и «отменить».
function stopEditing() {
  entryBody.contentEditable = 'false';
  showEditButtons(false);

  // Возвращаем фокус на перо. Это важно для тех, кто пользуется клавиатурой:
  // иначе после исчезновения галочки фокус «потеряется» и уйдёт в начало страницы.
  editBtn.focus();
}

// Галочка: сохраняем и выходим.
function saveEdit() {
  localStorage.setItem(STORAGE_KEY, entryBody.innerHTML);
  stopEditing();
}

// Крестик: возвращаем текст, каким он был до начала редактирования, и выходим.
function cancelEdit() {
  entryBody.innerHTML = textBeforeEdit;
  stopEditing();
}

// Привязываем функции к кнопкам.
// Обрати внимание: передаём саму функцию (startEditing), а не её вызов (startEditing()).
// Браузер вызовет её сам в момент клика.
editBtn.addEventListener('click', startEditing);
saveBtn.addEventListener('click', saveEdit);
cancelBtn.addEventListener('click', cancelEdit);


// Горячие клавиши внутри текста:
//   Esc               — отменить;
//   Ctrl+Enter (Cmd+Enter на Mac) — сохранить.
// Просто Enter не трогаем — он нужен, чтобы начать новый абзац.
entryBody.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    cancelEdit();
  } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();  // не даём Enter вставить лишнюю пустую строку
    saveEdit();
  }
});

// Вставка из буфера обмена.
// Если скопировать текст, например, из Word или с другого сайта, браузер
// по умолчанию вставит его вместе с чужими шрифтами, цветами и размерами.
// Перехватываем вставку и вставляем только чистый текст — он примет
// оформление нашей страницы.
entryBody.addEventListener('paste', (event) => {
  event.preventDefault();  // отменяем стандартную вставку
  const text = event.clipboardData.getData('text/plain');  // берём только текст

  // execCommand('insertText') вставляет текст в место курсора и сохраняет
  // возможность отменить это через Ctrl+Z. Формально команда устаревшая,
  // но полноценной замены у неё пока нет, и все браузеры её поддерживают.
  document.execCommand('insertText', false, text);
});

// Защита от потери правок.
// Событие beforeunload срабатывает, когда страницу пытаются закрыть или обновить.
// Если человек в режиме редактирования и что-то изменил, но не сохранил,
// браузер покажет стандартное окно «Покинуть сайт? Изменения могут не сохраниться».
// Текст этого окна задаёт сам браузер — изменить его нельзя.
window.addEventListener('beforeunload', (event) => {
  const hasUnsavedChanges =
    entryBody.isContentEditable && entryBody.innerHTML !== textBeforeEdit;

  if (hasUnsavedChanges) {
    event.preventDefault();
  }
});


/* =====================================================================
   ЧАСТЬ 4. ЭКСПОРТ И ИМПОРТ ДНЕВНИКА В ФАЙЛ .TXT

   Заголовок записи = имя файла, а внутри файла — только текст:

     Файл «День 1.txt»:
       Первый абзац...      ← абзацы,
                            ← разделённые пустыми строками
       Второй абзац...

   Экспорт называет файл по заголовку записи и кладёт в него абзацы.
   Импорт берёт заголовок из имени файла, а абзацы — из его содержимого.
   Поэтому скачанный файл можно загрузить обратно, и всё совпадёт.
   ===================================================================== */

const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importInput = document.getElementById('import-input');
const entryTitle = document.querySelector('.entry h2');

// Заголовок записи храним отдельно от текста: импорт может его поменять.
const TITLE_KEY = 'entry-day-1-title';

// При загрузке страницы подставляем сохранённый заголовок, если он есть.
const savedTitle = localStorage.getItem(TITLE_KEY);
if (savedTitle !== null) {
  entryTitle.textContent = savedTitle;
}


// Собирает текст записи в формат файла.
function entryToText() {
  // children — дочерние элементы блока (наши абзацы <p>).
  // Array.from превращает их в обычный массив, чтобы можно было пользоваться map и filter.
  //   map    — для каждого абзаца берём его текст без лишних пробелов по краям;
  //   filter — выбрасываем пустые абзацы (Boolean('') === false).
  let paragraphs = Array.from(entryBody.children)
    .map((element) => element.textContent.trim())
    .filter(Boolean);

  // Если человек при редактировании удалил все абзацы и написал текст «просто так»,
  // дочерних элементов не будет — тогда берём весь текст блока целиком.
  if (paragraphs.length === 0) {
    paragraphs = [entryBody.textContent.trim()];
  }

  // join склеивает элементы массива через указанный разделитель.
  // \n — перенос строки, значит \n\n — пустая строка между абзацами.
  // Заголовок в файл не пишем — он станет именем файла.
  return paragraphs.join('\n\n') + '\n';
}


// Скачивание файла.
// У браузера нет команды «сохрани файл», поэтому используется приём:
// создаём из текста Blob (файл в памяти), делаем на него временную ссылку
// с атрибутом download и «нажимаем» её из кода.
function downloadText(text, fileName) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);  // временный адрес вида blob:...

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;  // download = «скачать под этим именем, а не открыть»
  link.click();

  URL.revokeObjectURL(url);  // освобождаем память — ссылка больше не нужна
}


exportBtn.addEventListener('click', () => {
  // Имя файла = заголовок записи.
  // В именах файлов нельзя использовать некоторые символы: \ / : * ? " < > |
  // (Windows их запрещает). replace с флагом g заменяет ВСЕ такие символы на «-».
  // Если заголовок пустой, называем файл просто «Запись».
  const title = entryTitle.textContent.trim().replace(/[\\/:*?"<>|]/g, '-') || 'Запись';
  // Если файл с таким именем уже есть, браузер сам допишет (1), (2) и т.д.
  downloadText(entryToText(), `${title}.txt`);
});


// Кнопка импорта просто «нажимает» спрятанное поле выбора файла.
importBtn.addEventListener('click', () => {
  importInput.click();
});


// Событие change срабатывает, когда человек выбрал файл в окне.
importInput.addEventListener('change', async () => {
  // files — список выбранных файлов; нам нужен первый.
  // ?. — «если слева null или undefined, дальше не идти и вернуть undefined».
  const file = importInput.files?.[0];

  // Сбрасываем поле, чтобы можно было выбрать тот же файл ещё раз
  // (иначе change не сработает, ведь «ничего не изменилось»).
  importInput.value = '';

  if (!file) return;  // окно закрыли, ничего не выбрав

  let text;
  try {
    text = await file.text();  // читаем содержимое файла как текст
  } catch (error) {
    alert('Не получилось прочитать файл.');
    return;
  }

  // Делим текст на блоки по пустым строкам.
  // Регулярное выражение /\r?\n\s*\r?\n/ означает: перенос строки, потом
  // сколько угодно пробелов, потом ещё перенос. \r? — потому что в Windows
  // перенос строки записывается двумя символами \r\n, а в других системах одним \n.
  const blocks = text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    alert('Файл пустой.');
    return;
  }

  // confirm показывает стандартное окно с кнопками «ОК» и «Отмена»
  // и возвращает true, если нажали «ОК».
  if (!confirm('Заменить текущую запись содержимым файла?')) return;

  // Если в этот момент шло редактирование — выходим из него.
  if (entryBody.isContentEditable) {
    stopEditing();
  }

  // Заголовок = имя файла без расширения.
  // Регулярное выражение /\.[^.]+$/ находит точку и всё после неё до конца
  // строки (то есть «.txt»), а replace заменяет это на пустоту.
  // Если вдруг имя окажется пустым, оставляем прежний заголовок.
  const title = file.name.replace(/\.[^.]+$/, '').trim();
  if (title) {
    entryTitle.textContent = title;
  }

  // Собираем абзацы заново.
  // replaceChildren() без аргументов очищает блок, а с аргументами —
  // заменяет содержимое на переданные элементы.
  // Важно: текст вставляем через textContent, а НЕ через innerHTML.
  // textContent показывает всё как обычный текст, поэтому даже если в файле
  // окажется что-то похожее на HTML-код, оно не выполнится на странице.
  const paragraphs = blocks.map((block) => {
    const p = document.createElement('p');
    p.textContent = block;
    return p;
  });
  entryBody.replaceChildren(...paragraphs);  // ... — «разложить массив на отдельные элементы»

  // Сохраняем результат, чтобы он остался после перезагрузки.
  localStorage.setItem(STORAGE_KEY, entryBody.innerHTML);
  localStorage.setItem(TITLE_KEY, entryTitle.textContent);
});