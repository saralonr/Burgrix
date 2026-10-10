# Burgrix — tasarım ve teknik belge

## 1. Oyun

Burgrix, tarladan tezgâha bütün tedarik zincirini elinde tutan bir burger şirketini yöneten hicivli bir strateji oyunudur. Oyuncu dört bölümü aynı anda yönetir:

- **Tarlalar:** 20 parsellik bir arazi; meralar buzağı büyütür, soya tarlaları besiye yem verir. Orman kesmek, köy yakmak ve kasabanın buğdayını almak yer açar ama muhalifleri kızdırır. Toprak yoruldukça çöle döner; ormanlar azaldıkça iklim ısınır, kutup buzu erir.
- **Besi çiftliği:** en fazla 20 inek; yem, hormon, sanayi atığı ve hayvansal un. Kesim kilosuna ulaşan inek köfte olur ve bantla restorana gider.
- **Restoran:** üç ızgara, üç kasa; personelin morali, kuyruklar, rozet, uyarı, kovma.
- **Genel merkez:** dört reklam, dört halkla ilişkiler bağlantısı, yönetim kurulunun aylık kâr beklentisi, raporlar.

Beş grup (çevreciler, küreselleşme karşıtları, tüketici dernekleri, sendikalar, obezite davacıları) şirketi izler; sabırları tükenince grev, boykot ya da dava gelir. Oyun zamanla bitmez: kasa −30.000'e düşünce şirket iflas eder. Skor, ayakta kalınan ay sayısıdır.

Bütün kurallar ve sayılar: [docs/rules.md](docs/rules.md).

## 2. Mimari

```
src/sim/       oyun kuralları: durum, haftalık adım, komutlar, olaylar (DOM yok, tohumlu rastgelelik)
src/ui/        ekran: çizim kiti, sahneler, üst/alt çubuk, pencereler, menü, giriş noktası
src/audio/     ses sentezleyici ve Web Audio çalıcı
public/game/   tr.json, en.json (metinler), sounds.json (ses tarifleri), fonts/ (Nunito, OFL)
scripts/       pack.ts (yükleme paketi)
tests/         sim.test.ts (kurallar), ui.test.ts (metin, ses, simge, çizim, temizlik)
```

- **Sözleşme:** `src/sim/types.ts`. Arayüz durumu yalnız okur; değişiklikler komutlarla (`game.farm.makePasture(…)`, `game.restaurant.hire(…)` …) yapılır. `tick()` bir hafta ilerletir ve olay listesi döndürür (`cowSlaughtered`, `customerServed`, `protest` …); komutların doğurduğu olaylar bir sonraki `tick()` ile gelir.
- **Sayılar:** `src/sim/config.ts` (`defaultConfig`). `createGame(config?, seed?)` ile her sayı değiştirilebilir; testler aşırı değerlerle rastgeleliği sabitler.
- **Saat:** normal hızda bir hafta 1 saniye, hızlı modda 0,38 saniye. Saat; mola düğmesinde, kalıcı bir pencere açıkken ve sekme gizliyken durur (gizli sekmede ses de kısılır).

## 3. Ekran

- Mantıksal sahne 960×600; pencereye sığacak şekilde ölçeklenir (kenarlar koyu), çizim cihaz piksel oranında keskin kalır.
- **Üst çubuk:** kasa ve bu ayın sonucu; dört **dünya penceresi** (aynı ufuk çizgisi ve aynı yol dört yuvarlak pencereden geçer, böylece dört bölümün tek bir dünyanın parçası olduğu hissedilir; sorunlu bölümün penceresinde sarı işaret yanar); tarih, hafta noktaları ve mevsim simgesi; saat, hız ve menü düğmeleri.
- **Alt bilgi çubuğu:** üzerine gelinen şeyin adı, açıklaması, maliyeti/getirisi; sağda bölümün açık/kapalı göstergeleri (katkılar, GDO'lu tarla sayısı, başkan, köfte/burger stoku, çalışan kampanyalar).
- **Bağlam sırası:** bir nesneye dokununca üstünde simgeli düğmelerden oluşan bir sıra açılır; anahtar düğmelerde yeşil/gri lamba durumu gösterir. Düğmenin adı sıranın üstünde ve alt çubukta yazar.
- **Pencereler:** mesaj, kampanya kartı (başlat/durdur), kasa grafiği (noktalar o ayın bilançosunu açar), aylık bilanço (önceki/sonraki), muhalifler, yardım (6 sayfa), mola (ses düzeyi), iflas.
- **Klavye:** `1`–`4` bölümler, boşluk saati durdurur, `Esc` pencereyi kapatır ya da molayı açar.
- **İlk ziyaret:** her bölüme ilk girişte kısa bir tanıtım; ilk oyunda yardım sayfaları.

## 4. Görsel tasarım

Her şey kodla, `src/ui/draw.ts` kitiyle çizilir; dışarıdan resim dosyası yoktur.

- **Palet:** ketçap kırmızısı, hardal sarısı, marul yeşili, ekmek rengi, krem kâğıt ve koyu kahve kontur (`C` nesnesi).
- **Biçim:** 2:1 izometrik zemin, 2 piksellik koyu kahve kontur, düz renkli yüzler; üst yüz açık, sol yüz orta, sağ yüz koyu.
- **Kişiler** (`people.ts`): büyük yuvarlak baş, küçük gövde; saç modeli, ten, gömlek, şapka (aşçı şapkası, kasiyer kulaklığı, baret, kasket), gözlük, kravat ve önlük parçalardan kurulur. Ruh hâlleri: öfkeli, sıkılmış, sakin, mutlu; esneme, konuşma ve **endişeli** (alarmda zıplayıp kameraya bakar, terler). Müşteriler kimliklerinden türetilen rastgele görünümler alır.
- **İnekler** (`cows.ts`): tıknaz gövde, yuvarlak pembe burun, beş post deseni; kilo arttıkça gövde büyür; hasta inek soluk yeşil ve termometreli, deli dana dönen gözlü ve şimşekli.
- **Sahneler** (`scenes/`): tarlada mevsimle değişen çimen ve buğday, kasaba (ruh hâline göre ışıklar, insanlar, pankartlar, boşalınca gri), deniz (kutup buzu, kutup ayısı, deniz seviyesi cetveli), besiye giden yol ve kamyon; besi çiftliğinde iki ağıl, yemlikler, silo (seviye camı), katkı panosu, ahır, kesimhane ve restorana uzanan bant; restoranda damalı zemin, mutfak, köfte dolabı, ısıtma lambalı tezgâh, kasalar, kuyruklar, sokağa bakan camlar; genel merkezde reklam afişleri (çalışanlar yanar), bağlantı panosu, yönetim kurulu masası, rapor ekranı ve muhalif çubukları.
- **Simgeler** (`icons.ts`): 24×24 kutuda çizilen 50'ye yakın simge.
- **Yazı tipi:** Nunito (`public/game/fonts/`, lisans `OFL.txt`).

## 5. Metinler

`public/game/tr.json` ve `en.json` düz anahtar → metin eşlemeleridir; iki dosya aynı anahtarlara ve aynı `{yer tutucu}` adlarına sahip olmalıdır (test kontrol eder). Anahtar grupları: `menu.*`, `btn.*`, `tab.*`, `hud.*`, `hint.*`, `month.*`, `season.*`, `plot.*`, `soy.*`, `work.*`, `act.*`, `town.*`, `sea.*`, `silo.*`, `shed.*`, `alert.*`, `additive.*`, `cow.*`, `station.*`, `mood.*`, `office.*`, `camp.*`, `report.*`, `sheet.*`, `line.*` (bilanço satırları), `group.*`, `warn.*`, `protest.*`, `float.*`, `intro.*`, `help.*`, `pause.*`, `over.*`. İnek adları `cow.names` içinde virgülle ayrılır. Dil oyun sırasında değişirse hemen uygulanır.

## 6. Sesler

`public/game/sounds.json` içindeki her ses bir tariftir; oyun ilk dokunuşta sesleri `src/audio/synth.ts` ile sentezler (kayıt dosyası yoktur).

- Olay sesleri tek seferliktir (`click`, `open`, `close`, `till`, `moo1-3`, `slaughter`, `alarm`, `hey`, `harvest`, `plough`, `phone1-2`, `printer`, `voice1-6`, `gameOver` …).
- Döngüler: menüde `theme`; bölümlerde `farm`, `feedlot`, `restaurant` + `kitchen`, `town`.
- Tarif biçimi `synth.ts` başındaki açıklamadadır: enstrüman olayları (`i`, `n`/`f`, `t`, `d`, `v`) ya da nota dizili parçalar (`bpm`, `beats`, `tracks[].seq`).
- Ses düzeyi %20 ile başlar; menüdeki ve mola penceresindeki kaydırıcıyla değişir ve tarayıcıda saklanır (`burgrix.volume`).

## 7. Yayın ve güvenlik

- `npm run build` çıktısı (`dist/`) tamamen statiktir ve göreli yollar kullanır; herhangi bir web sunucusunda ya da statik barındırmada çalışır. `main` dalına her push'ta `.github/workflows/pages.yml` test edip derler ve GitHub Pages'te yayınlar.
- Oyun başka bir sunucuya bağlanmaz: betik, yazı tipi, metin ve ses tarifleri aynı kaynaktan yüklenir. `index.html` içindeki Content-Security-Policy yalnız aynı kaynağa izin verir; dinamik kod (`eval`, `new Function`) ve HTML enjeksiyonu (`innerHTML`) kullanılmaz (test kontrol eder).
- Dil: `?lang=tr|en`, yoksa tarayıcı dili, yoksa Türkçe; yalnız bu iki değer kabul edilir.
- Tarayıcıda yalnız iki küçük değer saklanır: ses düzeyi (`burgrix.volume`) ve en uzun süre (`burgrix.best`); kişisel veri toplanmaz.

## 8. Testler

- `tests/sim.test.ts`: kuralların tamamı (takvim, para, tarla, besi, restoran, merkez, muhalefet, ay sonu, iflas, aynı tohumla aynı sonuç).
- `tests/ui.test.ts`: kullanılan her metin anahtarının iki dilde de bulunması, her sesin ve simgenin tanımlı olması, menünün, dört sahnenin, çubukların ve bütün pencerelerin on yıllık yoğun bir oyun boyunca hatasız çizilmesi, yayınlanan dosyalarda başka oyunlara ait ad bulunmaması.
