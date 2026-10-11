-- Регламент SDS v2.0 (RU + EN). Дальше правится в Админке → Настройки.
update public.app_settings set
  regulation_version = '2.0',
  regulation_ru = $ru$
## 1. Общие положения

**1.1.** Sad Drift Series (SDS) — серия турниров по дрифту, состоящая из отдельных этапов. Настоящий регламент действует на протяжении всего чемпионата.

**1.2.** Участник обязуется знать и соблюдать данный регламент. Незнание правил не освобождает от ответственности.

**1.3.** Участие в чемпионате означает автоматическое согласие со всеми пунктами настоящего регламента.

**1.4.** Главный судья и маршалы определяются организаторами отдельно на каждый этап.

**1.5.** Главный судья имеет право пересматривать повторы и выносить окончательный вердикт.

**1.6.** За нарушение регламента могут быть вынесены наказания:

- **Предупреждение** — за незначительные нарушения.
- **Дисквалификация с этапа** — за грубые нарушения или повторные предупреждения.
- **Бан на все турниры SDS** — за систематические нарушения, читерство, неспортивное поведение или нарушение кодекса поведения.

Решение о наказании принимается организаторами и главным судьёй этапа с учётом тяжести и обстоятельств нарушения.

## 2. Формат соревнований

### 2.1. Квалификация (одиночные заезды)

Каждый пилот получает 3 заезда:

- **1-й заезд** — прогревочный. В зачёт не идёт, нужен для разогрева и проверки связи.
- **2-й и 3-й заезды** — результативные. Засчитывается лучший результат.

Цель — набрать максимум баллов (до 100). По итогам квалификации строится сетка ТОП-32.

### 2.2. Плей-офф (парные дуэли, ТОП-32)

- Сетка строится на основе результатов квалификации.
- Лидером в паре становится пилот с большим количеством баллов за квалификацию.
- Проходит два заезда. После первого пилоты меняются местами: лидер становится чейзером и наоборот.
- Решение о победе выносят судьи (голосованием / консенсусом).
- Если после двух заездов победитель не определён, назначается перезаезд — **OMT** (One More Time).
- Максимум — 2 OMT. Если и после второго OMT решения нет, побеждает пилот с большим количеством баллов за квалификацию.

## 3. Система оценки

### 3.1. Квалификация

Оцениваются 3 критерия, максимальная сумма — 100 баллов. Веса критериев задают организаторы на каждый этап (в сумме — 100).

| Критерий | Что оценивается |
|---|---|
| Траектория | Прохождение клиппинг-поинтов (вершин), касание внутренней бровкой |
| Угол | Максимально возможный угол заноса без потери скорости |
| Стиль | Чистота исполнения, плавность, зрелищность |

### 3.2. Парные дуэли

**Лидер** оценивается по тем же критериям, что и в квалификации: траектория, угол, стиль.

**Чейзер** оценивается по отдельным критериям:

- **Близость** — дистанция до машины лидера.
- **Угол за лидером** — способность держать угол, повторяя траекторию.
- **Синхронность** — совпадение по времени входа в занос, скорости и траектории.

## 4. Правила парных дуэлей

### Лидер (первый автомобиль)

- **Обязанность:** показывать чистую траекторию, двигаться предсказуемо.
- **Запрещено:** резко тормозить, «сушить» (выпрямлять руль), менять траекторию в последний момент, чтобы скинуть чейзера.
- **Штраф:** если лидер «сбрасывает» соперника — заезд пересматривается, лидер получает предупреждение.

### Чейзер (второй автомобиль)

- **Обязанность:** максимально плотно прижиматься к бамперу лидера, повторяя его траекторию.
- **Запрещено:** касаться машины лидера. Если контакт произошёл из-за грубой ошибки чейзера — заезд присуждается лидеру.
- **Бонус:** дополнительные баллы за «Зону стенки» (Close Wall).

## 5. Нештатные ситуации

### 5.1. Дисконнект (потеря соединения / вылет из игры)

- **В квалификации:** пилоту даётся перезаезд. Он отправляется в конец очереди и проезжает оставшуюся попытку (или обе, если не успел начать) после всех участников.
- **В парных дуэлях:** назначается полный перезаезд дуэли.

> Если дисконнект произошёл по вине игрока (специально выключил интернет, вышел из лобби) — перезаезд **не предоставляется**, фиксируется техническое поражение.

### 5.2. Задержка подключения

Если игрок вылетел и не успевает перезайти к старту своей дуэли, даётся **5 минут** на переподключение. По истечении времени — техническое поражение.

При пинге выше **150 мс** судья может попросить игрока покинуть сервер.

## 6. Штрафы и нарушения

Система штрафов может меняться от этапа к этапу и объявляется организаторами перед стартом каждого этапа.

| Нарушение | Последствие |
|---|---|
| Разворот — спин (полная потеря управления) | Оценка за заезд — 0 |
| Авария, контакт | Решение выносят судьи по ситуации |

## 7. Протесты

- Протест на решение судей можно подать **только в парных дуэлях** и **только проигравшему** пилоту.
- Срок — **5 минут** после решения судей, через личный кабинет на сайте.
- Обязательно приложить ссылку на видео-доказательство и описать, что судьи не увидели.
- Не больше **2 протестов** за этап.
- По протесту организатор может отклонить его, отдать победу или назначить перезаезд. Решение организатора окончательное.

## 8. Кодекс поведения

**8.1.** Участники обязаны вести себя уважительно и адекватно как на этапах, так и в сообществе SDS в целом.

**8.2.** Запрещено:

- оскорбления участников, судей, организаторов и зрителей;
- токсичное поведение, провокации, разжигание конфликтов;
- нецензурная лексика в адрес других участников;
- любые формы дискриминации.

**8.3.** За нарушение кодекса поведения — перманентный бан без права восстановления.

## 9. Визуальное оформление автомобилей (ливреи)

**9.1.** Запрещено использовать ливреи, содержащие:

- изображения вульгарного или порнографического характера;
- нецензурную лексику и оскорбительные надписи;
- политическую или религиозную пропаганду, разжигающую ненависть.

Нарушение карается снятием с турнира.

**9.2.** Обязательные элементы оклейки:

- наклейка с символикой SDS — на каждом автомобиле;
- стартовый номер — на заднем стекле, в верхнем правом углу (относительно взгляда вперёд).

Пример правильной оклейки — в канале #пример-ливреи.

## 10. Технические требования к автомобилям

**10.1. Вес.** Минимальный вес — 1050 кг.

**10.2. Колёса и шины.**

| Вес автомобиля | Задние колёса | Передние колёса |
|---|---|---|
| 1050–1200 кг | 265/35 R19 | Не ограничено |
| 1200 кг и выше | 285/35 R19 | Не ограничено |

**10.3. Мощность** — не ограничена.

**10.4. Настройки.** Автоматическая смена резины должна быть **отключена**.

**10.5. Модификации.** Запрещены все моды, читы, плагины и любые сторонние вмешательства в игру. Разрешён только стандартный контент игры.

## 11. Контакты

- Организатор SDS: **@sadlerk**
- Главный судья и маршалы этапа объявляются отдельно перед каждым этапом.
$ru$,
  regulation_en = $en$
## 1. General provisions

**1.1.** Sad Drift Series (SDS) is a series of drift tournaments made up of separate rounds. This rulebook applies throughout the championship.

**1.2.** Every participant must know and follow this rulebook. Not knowing the rules does not excuse a violation.

**1.3.** Taking part in the championship means automatic agreement with every clause of this rulebook.

**1.4.** The chief judge and marshals are appointed by the organizers separately for each round.

**1.5.** The chief judge may review replays and makes the final call.

**1.6.** Breaking the rules may lead to:

- **Warning** — for minor violations.
- **Disqualification from the round** — for serious violations or repeated warnings.
- **Ban from all SDS events** — for systematic violations, cheating, unsporting behaviour or breaking the code of conduct.

Penalties are decided by the organizers and the round's chief judge based on the severity and circumstances.

## 2. Competition format

### 2.1. Qualifying (solo runs)

Each driver gets 3 runs:

- **Run 1** — warm-up. Not scored; used to warm up and check the connection.
- **Runs 2 and 3** — scored. The best result counts.

The goal is to score as many points as possible (up to 100). Qualifying results set the TOP-32 bracket.

### 2.2. Play-off (tandem battles, TOP-32)

- The bracket is built from the qualifying results.
- The driver with the higher qualifying score leads the pair.
- Two runs are held; after the first, the drivers swap roles (leader becomes chaser and vice versa).
- The judges decide the winner (by vote / consensus).
- If there is no winner after two runs, a re-run is called — **OMT** (One More Time).
- Maximum 2 OMTs. If there is still no decision after the second OMT, the driver with the higher qualifying score wins.

## 3. Judging

### 3.1. Qualifying

Three criteria are judged, 100 points in total. The organizers set the criteria weights for each round (summing to 100).

| Criterion | What is judged |
|---|---|
| Line | Hitting clipping points, touching the inner kerb |
| Angle | The biggest possible drift angle without losing speed |
| Style | Clean execution, smoothness, show |

### 3.2. Tandem battles

The **leader** is judged on the same criteria as in qualifying: line, angle, style.

The **chaser** is judged on separate criteria:

- **Proximity** — distance to the leader's car.
- **Angle behind the leader** — holding angle while following the leader's line.
- **Sync** — matching the leader's entry timing, speed and line.

## 4. Tandem battle rules

### Leader (first car)

- **Must:** show a clean line and drive predictably.
- **Must not:** brake hard, straighten the car ("dry" the steering), or change line at the last moment to shake off the chaser.
- **Penalty:** if the leader shakes off the opponent, the run is reviewed and the leader gets a warning.

### Chaser (second car)

- **Must:** stay as close to the leader's bumper as possible, following their line.
- **Must not:** touch the leader's car. If contact is caused by a clear chaser mistake, the run goes to the leader.
- **Bonus:** extra points for the Close Wall zone.

## 5. Incidents

### 5.1. Disconnect (lost connection / game crash)

- **In qualifying:** the driver gets a re-run. They go to the end of the queue and drive the remaining attempt (or both, if they hadn't started) after everyone else.
- **In tandem battles:** the whole battle is re-run.

> If the disconnect is the driver's own fault (internet switched off on purpose, leaving the lobby), there is **no** re-run — it counts as a technical defeat.

### 5.2. Reconnection delay

If a driver drops and can't rejoin before their battle starts, they get **5 minutes** to reconnect. After that it's a technical defeat.

With a ping above **150 ms**, the judge may ask the driver to leave the server.

## 6. Penalties and violations

The penalty system may change between rounds and is announced by the organizers before each round.

| Violation | Consequence |
|---|---|
| Spin (complete loss of control) | 0 points for the run |
| Crash, contact | Decided by the judges case by case |

## 7. Protests

- A protest against a judges' decision can be filed **only in tandem battles** and **only by the losing** driver.
- Deadline — **5 minutes** after the decision, via the driver's account on the website.
- A link to video evidence and a description of what the judges missed are required.
- No more than **2 protests** per round.
- The organizer may reject the protest, award the win, or call a re-run. The organizer's decision is final.

## 8. Code of conduct

**8.1.** Participants must behave respectfully both during rounds and in the SDS community as a whole.

**8.2.** Prohibited:

- insulting participants, judges, organizers or viewers;
- toxic behaviour, provocation, stirring up conflicts;
- profanity directed at other participants;
- any form of discrimination.

**8.3.** Breaking the code of conduct results in a permanent ban with no right to appeal.

## 9. Car liveries

**9.1.** Liveries must not contain:

- vulgar or pornographic images;
- profanity or offensive text;
- political or religious propaganda inciting hatred.

Breaking this rule means removal from the tournament.

**9.2.** Required livery elements:

- the SDS sticker — on every car;
- the race number — on the rear window, top right corner (looking forward).

An example of a correct livery is in the #livery-example channel.

## 10. Technical requirements

**10.1. Weight.** Minimum weight — 1050 kg.

**10.2. Wheels and tyres.**

| Car weight | Rear wheels | Front wheels |
|---|---|---|
| 1050–1200 kg | 265/35 R19 | Unrestricted |
| 1200 kg and above | 285/35 R19 | Unrestricted |

**10.3. Power** — unrestricted.

**10.4. Settings.** Automatic tyre change must be **turned off**.

**10.5. Modifications.** All mods, cheats, plugins and any third-party interference with the game are prohibited. Only standard game content is allowed.

## 11. Contacts

- SDS organizer: **@sadlerk**
- The chief judge and marshals are announced separately before each round.
$en$
where id = 1;
