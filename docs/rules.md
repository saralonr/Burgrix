# Burgrix — game rules (functional specification)

This document is the single source of the game's behaviour. It describes **what the game does**, in
plain terms and with Burgrix's own numbers. The simulation (`src/sim/`) is written from this
document only. The user interface (`src/ui/`) draws the state and sends the player's commands.

Burgrix is a satirical management game about a burger chain that controls its whole supply line:
fields and pastures, a feedlot, a restaurant and a head office. The player earns money by selling
burgers and must keep five protest groups and a board of directors from turning against the company.
The game never ends by time; it ends when the company goes bankrupt.

All numbers live in one configuration object (`Config`, section 10) so they can be tuned.

---

## 1. Time

- The simulation advances in **weeks**. The interface calls `tick()` once per week; at normal speed
  one week lasts 1 second of real time. The player can pause and resume (the interface stops
  calling `tick()` while paused).
- A **month** has 4 weeks, a **year** has 12 months. The game starts in week 1 of January of year
  2000 (`startYear`).
- **Seasons** change in week 3 of March (spring), June (summer), September (autumn) and December
  (winter). The game starts in winter.
- Order of one `tick()`:
  1. In the very first week, the feedlot receives `startCows` cows (section 4).
  2. Restaurant week (section 5): patty deliveries, cooking, new customers, serving.
  3. The week counter advances. When week 4 has passed, the month ends (section 8) and a new month
     begins; then, if this is week 3 of a season month, the season changes (section 3.4).
  4. Feedlot week: health checks (section 4.4), then the slaughter line runs (section 4.5).
- Randomness comes from a seeded generator so that tests are repeatable. `chance(n)` below means
  "an integer drawn uniformly from 0..n-1 equals 0", i.e. a probability of 1/n.

## 2. Money

- The company starts with `startMoney` (50 000).
- Every payment goes through one ledger: **spend(amount, label)** lowers the money, adds to this
  month's expenses and records a line `label: amount` in this month's balance sheet; **earn(amount)**
  raises the money and this month's income. Payments are allowed to push the money below zero.
- **Bankruptcy:** at the end of a month, if the money is at or below `bankruptcy` (−30 000) the game
  is over. Below half of that (−15 000) the board warns that the account is in the red.

## 3. Farmland (sector "farm")

### 3.1 The map

The farm is a grid of 20 plots (`plots[0..19]`, a 5 × 4 grid; the interface decides where each plot
is drawn). Each plot has:

- `kind`: `forest`, `village`, `empty`, `grain` (the town's crops), `pasture`, `soy` or `desert`.
- `fertility` 0..`fertilityMax` (180), starting at the maximum.
- `herd` (pastures): 0..3 grazing cows, each with its own growth counter.
- `gm` (soy): genetically modified seed on or off.
- `work`: a work in progress or none: `clearing` (forest) / `burning` (village), the target kind
  (`pasture` or `soy`) and the weeks left.
- `soyStage` (soy only): `sowing` (new field, waits for the next winter), `growing` or
  `harvested`.

Initial map (Burgrix's own layout, index = row * 5 + column, row 0 at the back):

| row | col 0 | col 1 | col 2 | col 3 | col 4 |
|---|---|---|---|---|---|
| 0 | forest | forest | forest | grain | forest |
| 1 | forest | village | empty | grain | forest |
| 2 | forest | empty | empty | grain | empty |
| 3 | empty | empty | empty | grain | empty |

Next to the grid stand the **town** (it eats the grain) and the **sea** (it shows the polar ice; it
only has an information window).

### 3.2 Actions on a plot

Costs are paid at once. "Dissent" refers to section 7.

| plot | action | cost | effect |
|---|---|---|---|
| empty | make pasture | `pastureCost` 4 800 | becomes `pasture`, herd 2 |
| empty | sow soy | `soyCost` 9 600 | becomes `soy` in stage `sowing` |
| forest | clear for pasture | `clearPastureCost` 3 200 | ecologists +`ecoForest` (40), anti-globalists +`globalForest` (10); work for `clearWeeks` (3) weeks, then pasture (herd 2) |
| forest | clear for soy | `clearSoyCost` 7 800 | same dissent; after the work, soy in stage `sowing` |
| village | burn for pasture | `clearPastureCost` | anti-globalists +`globalVillage` (45); work, then pasture |
| village | burn for soy | `clearSoyCost` | anti-globalists +`globalVillage`; work, then soy (sowing) |
| grain | (only after the mayor is bribed) make pasture / sow soy | as for empty | the town loses one grain field |
| pasture | add a cow / remove a cow | free | herd 0..3; a removed cow is simply gone |
| pasture | turn into soy | `soyCost` | becomes soy (sowing) |
| pasture | sell | earns half of `pastureCost` | becomes empty |
| soy | genetically modified seed on/off | `gmCost` 25 per field per month | yield ×`gmYield` (1.4), consumers +1 per field per month, cows fall ill more easily |
| soy | turn into pasture | `pastureCost` | becomes pasture (herd 2) |
| soy | sell | earns half of `soyCost` | becomes empty |
| desert | — | — | nothing can be done |

A plot with work in progress accepts no action. A new pasture loses `pastureStartLoss` (80)
fertility at once.

### 3.3 Grazing, calves and soil

- Each grazing cow grows by 1 every month. When it reaches `calfMonths` (16), it is sent to the
  feedlot (section 4.1) and a new calf starts at 0 in the same place. If the feedlot is full, the
  grown cow waits on the pasture and tries again every month.
- Each month a pasture loses `herd − 1` fertility (one cow does not harm the soil, three cows cost
  2 per month). An empty plot regains `fertilityRegrow` (2) per month up to the maximum. Soy fields
  neither lose nor gain.
- A plot whose fertility drops to 0 or below becomes **desert**: its cows die and it can no longer
  be used.
- Fertility below `fertilityAlarm` (50) is shown as poor soil and feeds the ecologists (section 7).

### 3.4 Seasons and soy

- **Winter:** every soy field in stage `sowing` or `harvested` moves to `growing`.
- **Spring:** every `growing` field moves to `harvested`; the town's grain is harvested too (event
  `harvest`, an animation and a sound).
- **Summer:** every `harvested` soy field yields feed for the feedlot:
  `yield = round((soyBaseYield 210 + fertility / 2) × (gm ? gmYield : 1) × (industrial waste on ? wasteYield 1.2 : 1))`,
  added to the feed tank (section 4.2).
- **Autumn:** fields are ploughed (animation only).

### 3.5 The town and the mayor

- The town eats the grain of the `grain` plots (4 at the start). Its mood depends on how many are
  left: more than 2 → **content**, 2 → **short of food**, 1 → **hungry**, 0 → **deserted** (the town
  empties for good). The mood feeds the anti-globalists every month (section 7).
- The mayor can be bribed once for `bribeCost` (9 500). Only then can grain plots be taken over.

### 3.6 Climate

- Every month the number of forests sets how fast the climate warms: 7 or more forests → 0;
  5–6 → 2; 3–4 → 3; fewer than 3 → 4. The warming adds up in `warming` (starting at 0).
- The sea level shown is `min(10, round(warming / 100))` steps; the polar ice is
  `100 − 10 × steps` percent.

## 4. Feedlot (sector "feedlot")

### 4.1 Cows

- The feedlot has room for `maxCows` (20) cows in two pens. A cow has a name (drawn from Burgrix's
  own name list), a weight, an appetite and a health state.
- An arriving cow weighs `startWeight` (480); its appetite is one of `gain1/2/3` (38, 50, 62 kg per
  month), chosen at random.
- In the very first week, `startCows` (3) cows arrive.

### 4.2 Feed

- The feed tank holds up to `feedMax` (3 000) units and starts with `feedStart` (1 000).
- Every month, for each cow: if there is feed, the cow gains its appetite (plus `hormoneGain` 55
  when hormones are on) and eats `feedPerCow` (30) units (the tank never goes below 0); if there is
  no feed, the cow loses its appetite in weight and dies when it falls below `minWeight` (300).
- A cow that reaches `slaughterWeight` (960) leaves for slaughter (section 4.5).

### 4.3 Feed additives (switches; their state must always be visible)

| additive | cost | effect |
|---|---|---|
| animal meal | free | every slaughtered cow returns `mealFeed` (30) feed units; risk of the mad-cow disease |
| hormones | `hormoneCost` 15 per month | +`hormoneGain` kg per month; more illness |
| industrial waste | free | soy yield ×`wasteYield`; more illness |

### 4.4 Health (every week)

- Base safety `S = illnessBase (400) − number of cows`, minus `wasteRisk` (80) with industrial
  waste, minus `hormoneRisk` (80) with hormones, minus `gmRisk` (10) per genetically modified
  field; never below 10.
- Mad-cow safety (only while animal meal is on and the tank has feed):
  `B = bseBase (200) − bseSpread (10) × number of cows that had the mad-cow disease at the previous
  check`; never below 10.
- For every cow that is neither ill nor mad: with `chance(S)` it falls **ill**; otherwise, if `B`
  applies, with `chance(B)` it gets the **mad-cow disease**.
- An ill or mad cow keeps eating and growing. When it is slaughtered, consumers +`consumerIll` (15)
  for an ill cow, +`consumerMad` (35) for a mad one.
- The player can **destroy** a cow at any time (not while it is being taken to slaughter): it is
  removed without any meat.

### 4.5 Slaughter and patties

- A slaughtered cow yields `pattiesPerCow` (32) patties into a queue `pattiesToMake`.
- Every week up to `beltPerWeek` (24) patties leave this queue on the conveyor (`inTransit`).
  They reach the restaurant fridge at the start of the next restaurant week. The fridge holds
  `fridgeMax` (500) patties; patties beyond that are lost.

### 4.6 Feedlot alerts (the director waves when any is true)

Too many cows (`cows ≥ maxCows − 3`), no cows, little feed (`feed < 200`), the tank is full
(`feed ≥ feedMax`), an ill cow, a mad cow.

## 5. Restaurant (sector "restaurant")

### 5.1 Stations and staff

- 3 grills and 3 registers. Each station is empty or staffed. At the start, `grill1` and
  `register1` are staffed; the fridge holds `fridgeStart` (90) patties and `burgersStart` (40)
  burgers are ready. Hiring costs `crewWage` (420) per
  month per worker (charged at month end, section 8). A new worker has motivation `maxMotivation`
  (4) and no badge and no warning.
- Motivation 1..4 is shown as a face (angry, bored, calm, happy).
- Each month, with probability 6/`moraleDice` (6/30), one of the six stations (picked at random) loses
  1 motivation if it is staffed and above 1.
- **Badge** (reward, once per worker): with `chance(badgeLuck 3)` motivation returns to 4.
- **Warning** (discipline, once per worker): unions +`unionWarn` (10); with `chance(warnLuck 3)`
  motivation returns to 4.
- **Fire:** unions +`unionFire` (20); the station is empty; its queue leaves.

### 5.2 A restaurant week

1. Patties that arrived are added to the fridge (section 4.5).
2. **Cooking:** for each staffed grill, if there are patties: with probability
   `1 − 1/(motivation × 10)` it turns one patty into one burger; otherwise the cook yawns.
3. **New customers:** `footfall` customers arrive (section 6.2). Each joins the shortest queue
   that has a staffed register and room (a queue holds at most `queueMax`, 8); ties go to the
   lowest register number. A customer who finds no such queue walks away.
4. **Serving:** for each staffed register with customers and with burgers ready: with probability
   `1 − 1/(motivation × 10)` the first customer is served: one burger fewer, `burgerPrice` (550)
   earned, the customer leaves. Otherwise the cashier yawns.

### 5.3 Restaurant alerts (the manager waves when any is true)

Low morale (more than 2 workers and average motivation below 2.5); no patties (`patties < 3`); the
fridge is almost full (`patties > fridgeMax − 10`); long queues (every staffed register's queue at
`queueMax − 1` or more) — more grills are needed if fewer than 3 burgers are ready, more registers
otherwise.

## 6. Head office (sector "office")

### 6.1 Campaigns

Each campaign is switched on or off through a confirmation window that explains it; while on it
costs its monthly price (charged at month end).

| id | kind | monthly | effect |
|---|---|---|---|
| `kids` | advert | 520 | footfall +1; anti-globalists +`kidsGlobal` (0.5) per month |
| `pyramid` | advert ("balanced menu") | 580 | footfall +1; obesity −2 per month |
| `charity` | advert ("burgers for the poor") | 620 | footfall +1; anti-globalists −2 per month |
| `toons` | advert (cartoon tie-in) | 880 | footfall +2 |
| `politician` | lobby | 310 | anti-globalists −2, unions −2 per month |
| `climatologist` | lobby | 190 | ecologists −2 per month |
| `nutritionist` | lobby | 220 | obesity −6 per month |
| `inspector` | lobby | 210 | consumers −6 per month |

### 6.2 Footfall

Customers per week: 1, +1 per active advert (+2 for `toons`). A union **strike** sets it to 0; each
**boycott** (anti-globalists, ecologists) takes 1 away; never below 0.

### 6.3 The board

- The board expects a monthly profit of `expectStart` (400), raised by `expectStep` (80) at every
  new year up to `expectMax` (2 500).
- At the end of each month, with `profit = income − expenses` of that month: below expectation →
  board alarm +1; below 0 → +2; otherwise −1 (not below 0). The alarm is capped at 10; at the cap
  the board complains that the company does not grow.
- When the board complains (cap reached) or the account is below −15 000, the speaker at the head
  office raises the alarm and the board members frown; otherwise they smile.
- The head office screen shows an arrow up when the month was profitable, down otherwise.

### 6.4 Reports

- **Profit chart:** the money at each month end, for the current 5-year period (the series keeps at
  most 60 points; a new period starts every 5 years).
- **Balance sheets:** one per month (income, expenses, profit, money, and every expense line), kept
  for the same period; the latest can be opened at once, earlier ones from the chart points.
- **Opponents:** the five dissent levels (section 7) as bars.

## 7. Dissent

Five groups have a level 0..100: **ecologists**, **anti-globalists**, **consumers**, **unions**,
**obesity** (people suing for their weight). Each month, in this order:

- ecologists +1 per plot with poor soil (fertility < 50); consumers +1 per genetically modified field;
- anti-globalists +3 if the town is deserted, +2 if hungry, +1 if short of food; +0.5 with `kids`;
- obesity +2 if footfall is 2 or more, −1 otherwise;
- lobbies and adverts subtract as listed in 6.1; unions −1 (natural calm-down).

Then for each group (none goes below 0):

| level | effect |
|---|---|
| below 20 | the group's warning can be shown again later |
| 50–99 | a warning window once (until the level drops below 20 again) |
| 100 or more | protest, see below |

| group | protest | after it |
|---|---|---|
| unions | strike: footfall 0 for `strikeMonths` (6) months | level 19 |
| obesity | lawsuit: pay `obesityFine` (9 000) | level 0 |
| ecologists | boycott: footfall −1 for `boycottMonths` (12) months | level 19 |
| anti-globalists | boycott: footfall −1 for 12 months | level 10 |
| consumers | food poisoning case: pay `consumerFine` (6 000) | level 0 |

Each protest or warning is an event the interface shows in a window (with Burgrix's own texts).

## 8. End of the month

In this order:

1. Month (and year) counters advance; at a new year the board's expectation rises; every 5 years
   the chart and the balance sheets start a new period.
2. The balance sheet of the month is closed (income, expenses, profit); the board alarm is updated
   (6.3); if the money is at or below the bankruptcy line, the game is over.
3. Income and expenses restart at 0. **Monthly charges** are paid (they belong to the new month):
   genetically modified seed `gmCost` × fields, pasture upkeep `pastureUpkeep` (140) × pastures, soy
   upkeep `soyUpkeep` (140) × soy fields, every active lobby and advert, wages `crewWage` × workers,
   hormones `hormoneCost`.
4. The money is added to the chart.
5. Strike and boycott counters go down by 1.
6. Dissent (7), footfall (6.2), soil (3.3), climate (3.6), town mood (3.5), feeding (4.2),
   morale (5.1), grazing calves (3.3).

## 9. What the interface needs (the contract)

The contract is `src/sim/types.ts`. The simulation module `src/sim/game.ts` exports

```ts
export const defaultConfig: Config;
export function createGame(config?: Partial<Config>, seed?: number): Game;
```

- `tick()` advances one week and returns the events of that week. Events caused by commands
  (for example `plotChanged`, `cowDestroyed`, `warning`) are collected and returned by the next
  `tick()` together with the week's own events.
- Commands return `{ ok: true }` or `{ ok: false, reason }`: `over` after the game ended, `busy`
  when the plot has work in progress, `rule` when the action is not allowed there. Money never
  blocks a command.
- `farm.makePasture` / `farm.sowSoy` pick the action from the plot's kind (section 3.2);
  `farm.cost` tells the interface what that action would cost (or `null` when it is not allowed).
- Expense lines use these labels (the interface translates them): `pasture`, `soy`,
  `clearPasture`, `clearSoy`, `bribe`, `gm`, `pastureUpkeep`, `soyUpkeep`, `wages`, `hormones`,
  every campaign id, `fine:<group>`. A label appears once per month; repeated payments add up.
- The state is a plain object that only the simulation changes; the interface reads it.

## 10. Configuration

Every number in this document is a field of `Config` with the default given in brackets above.
`startYear` 2000, `startMoney` 50 000, `bankruptcy` −30 000, `weeksPerMonth` 4.
