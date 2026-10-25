# Pascal — передача результата

Кейс готов по маршруту `/work/pascal/`. Основной английский текст — 953 слова без метаданных и подписей. Использованы существующие коллекция `work`, `CaseStudyLayout`, `CaseFigure`, навигация и общая типографика. Текст ограничен 600px, иллюстрации — 1120px. Страница статическая, без JavaScript.

Изменения локальные: commit, push и deploy не выполнялись. Существующая работа Accord и посторонние изменения сохранены; прежние скриншоты Accord не перезаписывались.

## Файлы и переходы

- `src/content/work/pascal.mdx` — весь публичный текст, подписи, alt и шесть импортов.
- `src/assets/images/pascal/` — шесть неизменённых оригиналов WebP с описательными именами.
- `src/data/homepage.ts` — ссылка `/work/pascal/` у Research Brief (`42:382`, исторический alias `taskBoard`) и доступные названия Pascal/Accord.
- `src/components/Showcase.astro` — доступное название ссылки берётся из данных проекта вместо фиксированного Accord.
- `scripts/verify-output.mjs` — проверки обоих маршрутов, полного статического текста, оригиналов и дедупликации Pascal.
- `scripts/verify-browser.mjs` — общая матрица для Accord/Pascal с сохранением главной и Writing.
- `README.md` — актуальное описание двух кейсов и проверок.
- `docs/pascal-verification/` — новые скриншоты и `browser-verification.json`.
- `docs/pascal-handoff.ru.md` — этот отчёт с полной финальной копией.

Коллекция, схема и общие layout/figure/типографика не изменены. Порядок `42:382 → 42:378 → 42:393` сохранён; первоначально по центру остаётся Accord. Обе ссылки открываются в той же вкладке. Vocabulary, контроллер галереи, скролл, свайп и клавиатурное управление сохранены; кнопки навигации и autoplay не добавлялись.

## Изображения

Каждый исходник визуально проверен. Все оригиналы имеют размер 3840 × 2160 и сохраняют композицию 16:9. `CaseFigure` генерирует локальные responsive WebP через существующий Astro pipeline, задаёт размеры, alt, подпись и ссылку на неизменённый оригинал. Обложка загружается eager, остальные изображения lazy. Light и Dark доступны одновременно в обеих системных темах сайта. Production не обращается к Downloads.

| Экспорт                                   | Локальный оригинал                           | Размещение                                |
| ----------------------------------------- | -------------------------------------------- | ----------------------------------------- |
| `White X logo@2160p.webp`                 | `pascal-brand-original.webp`                 | Сразу после заголовка и подзаголовка      |
| `MacBook screen display@2160p.webp`       | `pascal-editor-light-original.webp`          | После Finding your place                  |
| `Computer screen application@2160p.webp`  | `pascal-editor-dark-original.webp`           | После Giving Markdown a readable surface  |
| `White dropdown menu@2160p.webp`          | `pascal-formatting-menu-light-original.webp` | После Making formatting discoverable      |
| `image.png@2160p.webp`                    | `pascal-command-palette-light-original.webp` | После One place to find notes and actions |
| `Command prompt interface@2160p (1).webp` | `pascal-command-palette-dark-original.webp`  | Следом за Light palette                   |

`Command prompt interface@2160p.webp` побайтово совпадает с вариантом `(1)`: SHA-256 `ee82de85456acfafc3ab22f1a1546663230407b3be6d52cc3a86e00f8934fc32`. Он не копировался. Тёмная палитра импортирована и показана один раз; шесть исходников имеют шесть различных хешей.

## Проверка

Успешно выполнены `pnpm check` (0 ошибок/предупреждений), `pnpm lint`, `pnpm format:check`, `pnpm verify:content`, `pnpm build` и `pnpm verify:output`, с закреплёнными Node 24.22.1 / pnpm 12.15.0. После исправления доступных названий сборка и браузерная проверка повторены.

В Yab проверены реальная главная, Selected work, переход в Pascal и внешний вид страницы. Автоматическая матрица существующего сценария выполнена в Chromium 156.0.8078.4: 10 сочетаний главной, 20 Writing и 40 кейсов (по 20 Accord/Pascal); ширины 320/375/768/1200/1440px, Light/Dark, с JS и без JS.

Проверены правильные превью и названия ссылок, исходный порядок/центрирование галереи, same-tab навигация, прямые URL, refresh, Back и обе ссылки возврата на главную. Полный текст и подписи присутствуют в статическом HTML. Все шесть изображений каждого кейса декодируются, не обрезаны и сохраняют пропорции; оригиналы отвечают 200 и побайтово совпадают с исходниками. Проверены Tab/Enter и видимый focus для всех ссылок на оригиналы, открытие изображения и Back, живая смена системной темы, 320px с текстом 200%, отсутствие overflow, ошибок консоли, page errors и пропавших ресурсов.

Сохранены проверки Projects/Selected work, клавиатуры, wheel, touch swipe, resize/reopen, скрытого фокуса, reduced motion, tilt/анимации Runnel, Writing и CLS < 0.01. Ошибок в итоговом отчёте нет. Клиентский JS: 5012 байт / 2348 gzip — без увеличения из-за кейса.

Скриншоты — браузерная эмуляция, не реальные устройства:

| Размер         | Light                                                        | Dark                                                        |
| -------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| Desktop 1200px | [Полная страница](pascal-verification/light-pascal-1200.png) | [Полная страница](pascal-verification/dark-pascal-1200.png) |
| Mobile 375px   | [Полная страница](pascal-verification/light-pascal-375.png)  | [Полная страница](pascal-verification/dark-pascal-375.png)  |

[Машиночитаемый отчёт](pascal-verification/browser-verification.json) также содержит геометрию, матрицу, ресурсы, ошибки и результаты взаимодействий. Скриншоты главной, Writing и Accord находятся в той же новой папке; прежние свидетельства сохранены отдельно.

## Оставшиеся фактические вопросы

- Какие совместные сценарии поддерживаются и как разграничены личные и общие документы? Нужны материалы о sharing, invitations, permissions, comments и одновременной работе, прежде чем описывать эти интерфейсы или поведение.
- Как сериализуются Bookmark, File, изображения, таблицы, задачи и другие поддерживаемые структуры внутри Markdown? Нужны примеры исходных заметок и правила представления/экспорта для проверки переносимости.
- Как вызываются меню форматирования и палитра? Есть ли подтверждённые клавиатурные команды? Текущий кейс не делает заявлений об этом.

Research Brief рассматривается как пример содержимого заметки. Интервью, методы и evidence tracking внутри него не используются как доказательства процесса Pascal. Метрики, сроки, авторские роли, коммерческие результаты и реализация приложения не придуманы. Личное/общее разграничение и перечисленные validation tasks описаны как будущие проверки.

## Полная финальная английская копия

# Pascal — Markdown notes for macOS

A personal space for Markdown notes, with optional team collaboration.

> Pascal’s opening artwork pairs a white geometric mark with a blue background, introducing the visual identity before the workspace.

## A personal starting point

Pascal is a note-taking application for macOS. All notes use Markdown, and personal use is its starting point: a place to collect ideas, develop a document, and return to work already in progress. Optional team collaboration extends that foundation.

The design premise is to keep writing clear while making organization and navigation available when needed. A note needs space to breathe, but its surroundings must still answer practical questions: where am I, what else is open, and how do I shape this content? The interface gives each concern a visible place without asking every control to compete with the document.

## Finding your place

My Space anchors the top of the sidebar. Search, References, Favorites, and Archives form a group above Notes, separating collection-level destinations from individual documents. Within Notes, Welcome to Pascal, Writing Ideas, and Research Brief pair names with distinct icons. The blue diamond beside Research Brief repeats in its open tab, connecting the two locations.

Sidebar and tabs support different scales of movement. The sidebar offers a way to locate a document within the collection; tabs above the editor keep open notes nearby. Research Brief has a filled selection in both places, while Writing Ideas remains visible alongside it. This repeated state helps connect the current document to its wider context.

Settings sits at the bottom, apart from everyday note navigation. The separation keeps configuration reachable while giving the document list a clearer boundary. Persistent navigation takes horizontal space, but also keeps orientation cues in view.

> The Light overview connects the selected Research Brief in the sidebar with its tab above the writing area; Writing Ideas stays visible as another open note.

## Giving Markdown a readable surface

Markdown is the common format beneath Pascal’s notes. The Research Brief example gives that foundation a structured visual surface: a document title, section headings, links, a bulleted list, a table, and tasks. Its research-related wording is sample note content.

The title establishes the document before quieter supporting text introduces it. Space between sections separates reading into smaller units. Links form a recognizable group, bullets give individual points a regular rhythm, and table columns align related information for comparison. Tasks use checkboxes to distinguish work items from ordinary prose.

These structures let one note hold several kinds of information. The tradeoff is keeping that variety readable without filling the writing area with formatting controls. Generous spacing and restrained dividers carry much of the hierarchy.

> The Dark overview preserves the same document structure: links, list items, table rows, and tasks remain distinct within a single note.

## Making formatting discoverable

The formatting menu names the available structures and groups them by purpose. Style contains Heading 1, Heading 2, and Heading 3. Blocks brings together Bullet List, Numbered List, Checklist, Code block, and Blockquote. Media contains Image, Bookmark, and File.

For someone deciding how to organize a passage, these labels turn an abstract formatting choice into recognizable options. The grouping narrows the scan: headings establish hierarchy, blocks organize content, and media entries offer additional material. Icons reinforce the names without carrying the explanation alone.

Keeping these options together leaves more room for the note. The tradeoff is discoverability: a compact menu is useful only when people can find it and recognize the appropriate action.

> Style, Blocks, and Media divide the formatting menu into three groups, with explicit labels for each available structure.

## One place to find notes and actions

The command palette combines a shared search field with separate Notes and Actions groups. Welcome to Pascal, Writing Ideas, and Research Brief retain their names and icons. Below them, Create New Note, Search Emoji, Settings, and Toggle Sidebar describe actions in plain language.

This arrangement brings document lookup and workspace commands into one compact surface. Group labels preserve the distinction between going somewhere and doing something. The benefit depends on clear naming: combining both kinds of entry also creates more options to scan.

An illustrative task is to locate Research Brief through the palette’s Notes group, open it, move to Writing Ideas through its document tab, then return through the Research Brief tab. The sidebar provides another visible entry to either note. This is a proposed sequence for an interactive walkthrough, using the entry points shown here.

> The Light palette separates note destinations from Create New Note, Search Emoji, Settings, and Toggle Sidebar beneath one search field.

> The Dark palette retains the same order, labels, and icons, making its surface treatment directly comparable with the Light version.

## Personal work with room for collaboration

Pascal also supports team collaboration. That capability extends a product centered on an individual’s Markdown notes, so the design concern is continuity: adding team activity while retaining a clear personal workspace.

My Space gives the personal foundation a visible name. A future design check should examine how someone distinguishes personal and shared work as they move between documents. Any boundaries between those contexts need to be understandable without making ordinary personal note-taking feel like workspace administration.

## Consistency across appearances

Light and Dark views preserve the relationship between sidebar, document tabs, and writing area. Surface contrast separates navigation from the note, while filled selections identify Research Brief. Secondary text recedes beneath titles and labels; colored note icons remain small recognition cues in both appearances.

The palettes follow the same hierarchy at a smaller scale. Their search field, group headings, separators, and action rows retain consistent positions. Subtle borders and muted text keep the surfaces quiet, but deserve close attention when checking readability.

Rounded window edges, macOS window controls, and a compact toolbar place the workspace in its desktop context. The brand artwork’s blue field and white geometric mark provide a stronger visual introduction alongside the restrained interface views.

## Design outcome and next checks

The artifacts bring Pascal’s personal focus into view through note navigation, open document tabs, structured note presentation, formatting options, and a command palette. Light and Dark treatments carry those decisions across appearances.

The next validation work should use concrete tasks:

- Find and reopen a note.
- Move between open notes without losing orientation.
- Discover the appropriate formatting action.
- Check the Markdown representation of supported content structures.
- Evaluate how personal and shared work would remain distinguishable.

These are proposed checks for a future interactive version, including how richer content is represented within Markdown notes.
