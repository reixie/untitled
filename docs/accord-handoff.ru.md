# Accord: передача результата

Локальный редакторский отчёт; не входит в HTML сайта. Изменения подготовлены для ревью, без commit, push или deploy.

## Реализация

Маршрут: `/work/accord/`. Локальный preview: [открыть кейс](http://127.0.0.1:4321/work/accord/).

Полный английский текст находится в `src/content/work/accord.mdx`; основной текст содержит около 982 слов, без подписей и метаданных. Отдельная коллекция `work` требует только title, subtitle и description. Дата, роль автора, сроки, клиент, исследования и метрики не добавлены. Название Accord представлено как рабочее название проекта; внешняя аффилиация не заявлена.

Страница использует существующие Inter, семантические цвета и системную тему. Колонка чтения — до 600 px, иллюстрации — до 1120 px с боковыми полями. Light/Dark исходники расположены последовательно и доступны при любой теме сайта. Кейс статический, без JavaScript. Ссылки View full-size image открывают неизменённый оригинал в той же вкладке; назад можно вернуться браузером. Обложка загружается сразу, остальные изображения — lazy; у всех есть alt, подпись, размеры и responsive srcset.

Центральный элемент Selected work с companyTable и sourceNode `42:378` теперь ведёт на кейс. Порядок `42:382 → 42:378 → 42:393`, начальный центр, клавиши, swipe/scroll и контроллер галереи сохранены. Остальные проекты и их назначения не изменены. Writing остаётся отдельной коллекцией.

## Файлы

Новые:

- `src/content/work/accord.mdx` — редакторский материал и размещение изображений.
- `src/pages/work/[...id].astro` — статические маршруты Selected work.
- `src/layouts/CaseStudyLayout.astro` — широкие иллюстрации и узкая колонка чтения.
- `src/components/CaseFigure.astro` — responsive изображение, подпись и доступ к оригиналу.
- `src/components/BackLink.astro`, `src/styles/prose.css` — общие примитивы кейса и статьи.
- `src/assets/images/accord/` — шесть оригинальных WebP.
- `docs/accord-verification/` — скриншоты и машинные результаты.
- `docs/accord-handoff.ru.md` — этот отчёт с полным итоговым текстом.

Изменены:

- `src/content.config.ts` — небольшая схема work без даты.
- `src/data/homepage.ts`, `src/components/Showcase.astro` — ссылка центрального изображения.
- `src/layouts/DocumentLayout.astro` — широкая область кейса.
- `src/layouts/ArticleLayout.astro` — использует общие ссылку и типографику; содержание статьи сохранено.
- `scripts/verify-output.mjs`, `scripts/verify-browser.mjs` — отдельные проверки кейса при сохранении утверждений главной и Writing.
- `README.md` — описание страницы и актуальные команды проверки.

Зависимости, lockfile, глобальные цвета, шрифты, статья Writing и интерактивные контроллеры не изменены. Инструменты браузерной проверки установлены вне проекта, в `/private/tmp`.

## Изображения и источники

Все шесть изображений визуально просмотрены. Имена экспортов не использованы как доказательства функциональности. Исходная папка — `/Users/alex/Downloads/`; импортированные файлы — `src/assets/images/accord/`.

| Исходный экспорт                        | Файл в репозитории                        | Размещение                                        | Размер и пропорции |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------- | ------------------ |
| White cross symbol@2160p.webp           | accord-brand-original.webp                | Обложка, перед первым разделом                    | 3840 × 2160; 16:9  |
| Microsoft Teams interface@2160p.webp    | accord-application-shell-original.webp    | После Organizing the workspace                    | 3456 × 2160; 8:5   |
| Colorful spreadsheet squares@2160p.webp | accord-companies-light-original.webp      | После Making company information scannable, Light | 3840 × 2160; 16:9  |
| Project management tool@2160p.webp      | accord-companies-dark-original.webp       | Следом за Light, тот же каталог                   | 3840 × 2160; 16:9  |
| Settings menu@2160p.webp                | accord-workspace-menu-light-original.webp | После Light and Dark presentation, светлое меню   | 3840 × 2160; 16:9  |
| Dark computer interface@2160p.webp      | accord-workspace-menu-dark-original.webp  | Следом за светлым меню, тёмное оформление         | 3840 × 2160; 16:9  |

Исходники скопированы побайтно; SHA-256 и соответствия записаны в [source-images.json](accord-verification/source-images.json). Статическая проверка также сравнивает оригинал в production-выводе с файлом в исходниках. Производные генерирует существующий Astro image pipeline, без crop или изменения композиции.

## Проверка

Среда: Node 24.22.1, pnpm 12.15.0, Astro 7.4.2. Ручной переход по реальной ссылке главной и визуальный просмотр выполнены в Yab. Автоматическая проверка — Chromium 156 headless через Playwright, без добавления зависимостей проекта.

Пройдены `check`, `lint`, `format:check`, `verify:content`, `build`, `verify:output` и расширенный `scripts/verify-browser.mjs`.

- `check`: 0 ошибок, предупреждений и hints.
- `verify:content`: Markdown/MDX, статический Astro-компонент, порядок Writing, исключение draft без даты и все проверки некорректных метаданных сохранены.
- `verify:output`: ровно три HTML-маршрута, полный текст статьи и кейса, шесть иллюстраций, локальные оригиналы, правильный элемент галереи; кейс без script/time, Writing со своей датой. JS сайта: 5012 байт, 2348 байт gzip, при лимите 30720.
- Главная: 10 комбинаций темы/ширины и 10 дополнительных no-JS проверок. Сохранены вкладки, центр галереи, геометрия, стрелки/Home/End, resize/reopen, pointer tilt, canvas, reduced motion и scroll. Touch swipe проверен протоколом Chromium.
- Статья: 20 комбинаций темы/ширины/JS; полный текст, дата, переход, refresh, ссылка домой и клавиатура сохранены.
- Кейс: 20 комбинаций — темы light/dark, ширины 320/375/768/1200/1440 px, JavaScript включён/выключен. Везде полный текст, шесть декодированных локальных изображений с исходными пропорциями, правильные темы и колонка чтения, без горизонтального overflow.
- Проверены реальная ссылка центрального изображения, переход в той же вкладке мышью и Enter, прямой URL, refresh (200), browser Back, обе ссылки домой, последовательность Tab и видимый focus, все шесть ссылок на оригиналы (200, image/webp), переход к оригиналу и возврат.
- Проверены живое изменение системной темы и 200% текст при 320 px. Новых console/page errors, пропавших ресурсов и неуспешных запросов не обнаружено.

Полные измерения: [browser-verification.json](accord-verification/browser-verification.json). Скриншоты визуально просмотрены; это браузерная эмуляция размеров и touch, не испытания на физических телефонах. Safari и реальные устройства не проверялись. Проверки портфолио не являются юзабилити-тестированием CRM.

| Тема  | Desktop, 1200 px                                             | Mobile, 375 px                                              |
| ----- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| Light | [Полная страница](accord-verification/light-accord-1200.png) | [Полная страница](accord-verification/light-accord-375.png) |
| Dark  | [Полная страница](accord-verification/dark-accord-1200.png)  | [Полная страница](accord-verification/dark-accord-375.png)  |

Для повторного запуска используются существующие команды README и внешний Playwright. В этой сессии:

```sh
PATH=/private/tmp/untitled-runtime/node-v24.22.1-darwin-arm64/bin:$PATH \
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/accord-browser \
PLAYWRIGHT_MODULE=/private/tmp/personal-space-browser-qa/node_modules/playwright/index.mjs \
node scripts/verify-browser.mjs
```

## Неоднозначности и дальнейшие вопросы

В тёмном крупном меню (`Dark computer interface…`) и полном shell (`Microsoft Teams interface…`) справа от Theme написано Light, а в подменю стоит галочка возле Light, хотя поверхности тёмные. Контекст взаимодействия неизвестен. Оригиналы не ретушировались; публичный текст описывает визуальные варианты и наличие Light/Dark/System, не объясняет это состояние и не обещает переключение, сохранение настроек или проверенную доступность. Alt тёмного меню точно передаёт видимую отметку Light.

Перед последующим описанием поведения темы нужно уточнить, какое состояние показывают эти два экспорта. Других фактических вопросов, блокирующих текущую редакцию, нет: неизвестные роль, даты, исследования и результаты сознательно не включены. Имена, логотипы и цифры таблицы обозначены как sample interface data. На сайте нет утверждений о Microsoft integration, отдельном project-management экране, разработанном onboarding, AI или работе разделов, показанных только в навигации.

## Полный итоговый текст кейса (English)

# Accord — a CRM for small teams

Bringing company records and everyday team tools into a shared workspace.

_A rounded geometric mark gives Accord a recognizable shape, from the opening artwork to its small workspace icon._

## A shared place for everyday work

Accord is a modern CRM system for small teams, intended to simplify everyday work and collaboration. Its organizing idea is to bring company records and everyday team tools into one shared workspace. The company directory is the clearest expression of that idea: a structured view of customer information, with the wider workspace always in reach.

The interface brings two scales of work together. Someone can review the available context around a company while keeping sight of destinations for tasks, meetings, and notes. Accord is the working project name shown in these designs.

## The design challenge

The design premise is straightforward: make customer information and everyday team tools easier to navigate within a shared interface. A CRM needs room for detailed records, but the surrounding controls should help people orient themselves before asking them to interpret a dense table.

The challenge is balancing that breadth with clarity. Giving every destination equal weight would compete with the current task. Grouping navigation and separating workspace actions from record controls supports a more legible hierarchy, while keeping the directory central.

## Organizing the workspace

The sidebar separates Records—Companies, People, and Opportunities—from Tools—Tasks, Meetings, and Notes. This structure supports an initial choice between looking up information and moving toward an activity. Companies has a filled selected state, connecting the navigation to the page title and table beside it.

Search, Home, and Inbox sit above those groups. Integrations and Help & Support sit near the bottom, while Partners appears under List. These labels establish visible destinations; the screens here demonstrate the Companies view, rather than the functionality behind every entry. Keeping supporting navigation apart gives the core groups more definition, though a longer sidebar still asks people to scan several sections.

_The expanded workspace menu sits within the application shell. This view shows its relationship to navigation; the blank content area does not describe an onboarding flow._

## Making company information scannable

The Companies table carries the most detailed design work. Each row begins with a company logo and name, followed by its domain, category labels, employee count, revenue, and address. Names and domains offer two ways to recognize an entry. Consistent column positions let someone move across a row without relearning where each kind of information belongs.

Category tags use compact colored backgrounds inside an otherwise neutral table. Their text carries the label, while color helps distinguish clusters during a scan. Thin dividers and a regular row rhythm keep adjacent records separate without heavy boxes. Employee and revenue values begin at consistent positions in their columns, and currency symbols occupy a repeated position beside the amounts.

Consider one task: finding a company and reviewing its available context. The selected Companies destination establishes the location, and All Companies names the visible view. A search field labeled Search companies offers a clear place to begin looking. Once the relevant row is found, the reader can follow its domain, categories, and numeric fields across the table. The supplied designs stop at this overview; they do not show a company detail page or a completed search interaction.

Filter and Display sit together above the table, separating view-related controls from the New action in the page header. Their placement makes those entry points discoverable without filling each row with controls. The images establish their labels and hierarchy, but leave their subsequent interactions open.

Density is the main tradeoff. Seventeen sample companies fit in one view, making comparison possible across many records. Yet long addresses and some category groups meet the column edges, showing the pressure that detailed content places on fixed space. Company names, logos, domains, figures, and addresses are sample interface data, not verified business facts or client endorsements.

_Light presentation: neutral surfaces and fine dividers carry the table structure, leaving logos and category tags as the strongest color accents._

_Dark presentation of the same directory preserves the column positions and row rhythm, making the two visual treatments directly comparable._

## Workspace context and team entry points

The workspace selector keeps Accord visible at the top of the sidebar. Its expanded menu lists Accord and My Space, with a check beside Accord. This gives the current context a persistent label and places alternative workspace entries nearby.

Invite people and Settings share a separate group below the workspace entries. Theme and Log out follow beneath another divider. Bringing these secondary actions into one menu keeps them reachable without competing with company information. The tradeoff is discovery: someone must open the selector to see them. The menu establishes entry points, without specifying permissions, invitation steps, or collaboration behavior.

## Light and Dark presentation

The directory variants retain the same hierarchy through different surfaces. Light styling uses pale backgrounds, subtle borders, and dark text. Dark styling places a slightly lighter table surface against the surrounding shell, with muted dividers and light text. In both, a filled Companies selection is distinct from the unselected navigation, and category colors remain concentrated inside tags.

The menu close-ups show the corresponding surface treatments and a Theme submenu containing Light, Dark, and System. These are designed appearance choices. The images demonstrate their presentation, without establishing switching behavior or saved preferences. Borders and secondary text deserve particular attention in later checks because their restraint also makes them easier to overlook.

_Light menu styling uses dividers to separate workspace entries, team actions, and appearance controls within a compact surface._

_The corresponding dark-styled menus preserve the grouping and submenu hierarchy, allowing their visual treatment to be compared directly._

## A consistent visual identity

The brand artwork pairs a white geometric mark with a blurred, multicolored background. Rounded stepped edges surround a cross-shaped opening. The same form appears at a smaller scale inside the workspace icon beside Accord. Repetition connects the expressive artwork to the restrained interface, giving the product a recognizable visual anchor without adding decoration to the table.

## Design outcome and next checks

Together, these artifacts demonstrate a coherent company directory, grouped navigation, a workspace menu, and Light and Dark visual variants. They make the product’s organizing idea tangible: records remain central, with everyday tools and workspace actions arranged around them.

The next validation work should test that structure through concrete tasks:

- Find a named company and review its available context across a row.
- Interpret category labels without relying on their colors.
- Locate the current workspace, Invite people, and Settings.
- Check dense tables at narrower widths, especially long addresses and category groups.

These are proposed checks for a future interactive version.
