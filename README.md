# دیتاست‌های عمومی بیوانفورماتیک در GitHub

فهرست دیتاست‌های عمومی بیوانفورماتیک که روی GitHub منتشر شده‌اند. برای هر کدام لینک ریپازیتوری و لینک یا روش دانلود آمده است.

> **سایت:** همین داده‌ها به شکل یک سایت قابل‌جستجو با شکل‌های سه‌بعدی، تاریخچه‌ی نسخه‌ها، مقاله‌های هر حوزه و وضعیت روزانه‌ی منبع‌ها در پوشه‌ی [`site/`](site/) است و هر روز خودکار به‌روز می‌شود. ساختار و نحوه‌ی انتشار: [PLATFORM.md](PLATFORM.md). نقشه‌ی راه: [ROADMAP.md](ROADMAP.md). لایسنس کد: `MIT OR Apache-2.0`.

- دیتاست‌ها **بر اساس موضوع** دسته‌بندی شده‌اند و در هر دسته **بر اساس تعداد ستاره‌ی GitHub** (از زیاد به کم) مرتب هستند.
- ⭐ = تعداد ستاره در زمان جمع‌آوری (نوامبر ۲۰۲۶). «—» یعنی ریپو در دور دوم اضافه شد و ستاره‌اش ثبت نشد. این ردیف‌ها آخر جدول آمده‌اند.
- دیتاست‌ها و بنچمارک‌هایی که ریپوی GitHub خودشان را ندارند (Hugging Face، Kaggle، سایت‌های چالش، دیتاست‌های مقالات طراحی مولکول) در [بخش ۱۳](#13-دیتاستها-و-بنچمارکهای-مقالات) هستند و بر اساس میزان استفاده یا اهمیت مرتب شده‌اند.
- همین فهرست به شکل جدول در [datasets.csv](datasets.csv) هم هست.

**فایل‌های دیگر این مخزن:**

| فایل | محتوا |
|---|---|
| [DATABASES.md](DATABASES.md) | حدود ۳۰۰ دیتابیس آنلاین (NCBI، Ensembl، UniProt، PDB، gnomAD، GDC و...) با آخرین نسخه، روش دسترسی (وب، FTP، API، CLI) و مجوز داده |
| [VERSIONS.md](VERSIONS.md) | همه‌ی نسخه‌ها و انتشارهای هر دیتابیس با تاریخ و الگوی آدرس، برای تکرارپذیری. همین داده به شکل CSV در [databases_versions.csv](databases_versions.csv) هم هست. |
| [TOOLS.md](TOOLS.md) | ابزارهای دانلود و تحلیل، و بخش «مشکلات ابزارهای موجود» با لینک issueها و وضعیت نگهداری |
| [TOOL_DESIGN.md](TOOL_DESIGN.md) | طرح یک ابزار متن‌باز یکپارچه (هسته‌ی Rust) برای دانلود ساده، کم‌مصرف و تکرارپذیر همه‌ی این داده‌ها |

> **روش جمع‌آوری:**
> 1. **دور اول (GitHub):**
>    - جستجو در GitHub Search API با عبارت‌های `topic:bioinformatics topic:dataset(s)`، `bioinformatics dataset`، `genomics dataset`، `single-cell dataset`، `protein dataset` و `awesome bioinformatics` (۳۱۲ ریپو).
>    - ریپوهای ابزار از دیتاست‌ها جدا شدند.
>    - لینک‌های دانلود از README خود هر ریپو استخراج شدند.
>    - چند دیتاست شناخته‌شده‌ی دیگر (TAPE، ProteinGym، OGB، DRKG و...) دستی اضافه شدند.
> 2. **دور دوم (نوامبر ۲۰۲۶):**
>    - برای هر حوزه (ژنوم، reads، بیان ژن، تک‌سلولی، واریانت، سرطان، پروتئین، مسیرها، دارو، اپی‌ژنومیکس، RNA، میکروبیوم و بنچمارک‌های ML) سایت، FTP یا API رسمی بررسی شد.
>    - آخرین نسخه و فهرست نسخه‌ها با درخواست HEAD، فهرست پوشه‌ها یا خواندن فایل نسخه زنده چک شد. هیچ دیتاستی دانلود نشد.
>    - موارد چک‌شده با ✅ و موارد از دانسته‌های قبلی با ⚠️ علامت خورده‌اند.
>    - ۱٬۲۸۰ مدخل فهرست [AspirinCode/papers-for-molecular-design-using-DL](https://github.com/AspirinCode/papers-for-molecular-design-using-DL) (۸۷۷ مقاله‌ی یکتا، ۵۴۷ ریپو) خوانده شد تا معلوم شود هر مقاله از کدام دیتاست استفاده کرده است.
>    - issue trackerهای ۲۶ ابزار دانلود داده بررسی شدند تا مشکلات رایج پیدا شوند.
>
> **محدودیت:** گشتن «همه‌ی» اکانت‌های GitHub عملاً ممکن نیست. این فهرست ریپوهای مطرح و قابل‌جستجو را پوشش می‌دهد، نه همه‌ی آن‌ها را. لینک‌ها ممکن است با گذشت زمان عوض شوند.

---

## فهرست

1. [پروتئین: توالی، ساختار و عملکرد](#1-پروتئین-توالی-ساختار-و-عملکرد)
2. [پروتئین–لیگاند و کشف دارو](#2-پروتئینلیگاند-و-کشف-دارو)
3. [برهم‌کنش پروتئین–پروتئین (PPI)](#3-برهمکنش-پروتئینپروتئین-ppi)
4. [ژنومیکس و DNA](#4-ژنومیکس-و-dna)
5. [تک‌سلولی (Single-cell) و ترانسکریپتومیکس فضایی](#5-تکسلولی-single-cell-و-ترانسکریپتومیکس-فضایی)
6. [گراف دانش و شبکه‌های زیستی](#6-گراف-دانش-و-شبکههای-زیستی)
7. [سرطان و مولتی‌اومیکس بالینی](#7-سرطان-و-مولتیاومیکس-بالینی)
8. [میکروبیوم و متاژنومیکس](#8-میکروبیوم-و-متاژنومیکس)
9. [RNA](#9-rna)
10. [پاتولوژی و تصویربرداری زیستی](#10-پاتولوژی-و-تصویربرداری-زیستی)
11. [متن زیست‌پزشکی (NLP) و بنچمارک‌های کدنویسی](#11-متن-زیستپزشکی-nlp-و-بنچمارکهای-کدنویسی)
12. [فهرست‌های گردآوری‌شده (Awesome lists)](#12-فهرستهای-گردآوریشده-awesome-lists)
13. [دیتاست‌ها و بنچمارک‌های مقالات](#13-دیتاستها-و-بنچمارکهای-مقالات)

---

## 1. پروتئین: توالی، ساختار و عملکرد

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **TAPE**: بنچمارک یادگیری بازنمایی پروتئین (Pfam، ساختار ثانویه، Remote homology، Fluorescence، Stability) | 746 | [songlab-cal/tape](https://github.com/songlab-cal/tape) | [pfam](http://s3.amazonaws.com/songlabdata/proteindata/data_pytorch/pfam.tar.gz) · [secondary_structure](http://s3.amazonaws.com/songlabdata/proteindata/data_pytorch/secondary_structure.tar.gz) · [remote_homology](http://s3.amazonaws.com/songlabdata/proteindata/data_pytorch/remote_homology.tar.gz) · [fluorescence](http://s3.amazonaws.com/songlabdata/proteindata/data_pytorch/fluorescence.tar.gz) · [stability](http://s3.amazonaws.com/songlabdata/proteindata/data_pytorch/stability.tar.gz) · [proteinnet](http://s3.amazonaws.com/songlabdata/proteindata/data_pytorch/proteinnet.tar.gz) |
| 2 | **ProteinGym** (آخرین نسخه v1.3): بنچمارک پیش‌بینی اثر واریانت‌ها (DMS) | 488 | [OATML-Markslab/ProteinGym](https://github.com/OATML-Markslab/ProteinGym) | [Hugging Face](https://huggingface.co/datasets/OATML-Markslab/ProteinGym_v1) · [Zenodo](https://doi.org/10.5281/zenodo.15293562) |
| 3 | **SidechainNet**: ساختار تمام‌اتمی پروتئین برای ML | 365 | [jonathanking/sidechainnet](https://github.com/jonathanking/sidechainnet) | `pip install sidechainnet` ← `scn.load(casp_version=12, casp_thinning=30)` |
| 4 | **FoldBench**: بنچمارک کم‌همولوژی پروتئین، اسید نوکلئیک و لیگاند | 160 | [BEAM-Labs/FoldBench](https://github.com/BEAM-Labs/FoldBench) | [Google Drive](https://drive.google.com/file/d/17KdWDXKATaeHF6inPxhPHIRuIzeqiJxS/view?usp=sharing) |
| 5 | **FLIP**: بنچمارک fitness landscape پروتئین | 145 | [J-SNACKKB/FLIP](https://github.com/J-SNACKKB/FLIP) | [flip.protein.properties](https://flip.protein.properties/#downloads) · [Zenodo](https://doi.org/10.5281/zenodo.18433203) |
| 6 | **ProteinShake**: دیتاست‌های ساختار پروتئین برای ML | 116 | [BorgwardtLab/proteinshake](https://github.com/BorgwardtLab/proteinshake) | `pip install proteinshake` ([مستندات](https://proteinshake.readthedocs.io/en/latest/notebooks/dataset.html)) |
| 7 | **CPSea**: کمپلکس‌های پپتید حلقوی–پروتئین (از AFDB) | 72 | [YZY010418/CPSea](https://github.com/YZY010418/CPSea) | [Zenodo](https://zenodo.org/records/17324994) · [Kaggle](https://www.kaggle.com/datasets/ziyiyang180104/cpsea) |
| 8 | **Prop3D**: ساختار سه‌بعدی همراه با ویژگی‌های بیوفیزیکی | 40 | [bouralab/Prop3D](https://github.com/bouralab/Prop3D) | [Prop3D-20.h5](https://zenodo.org/record/6873024/files/Prop3D-20.h5) |
| 9 | **CBH21 Protein Solubility**: حلالیت پروتئین | 24 | [ProteinQure/cbh21-protein-solubility-challenge](https://github.com/ProteinQure/cbh21-protein-solubility-challenge) | داخل ریپو (`git clone`) |
| 10 | **PS4**: بزرگ‌ترین دیتاست باز ساختار ثانویه از تک‌توالی | 15 | [omarperacha/ps4-dataset](https://github.com/omarperacha/ps4-dataset) | داخل ریپو (`git clone --recursive`) |
| 11 | **CB513**: ساختار ثانویه‌ی پروتئین | 12 | [taneishi/CB513_dataset](https://github.com/taneishi/CB513_dataset) | [Princeton ICML2014](http://www.princeton.edu/~jzthree/datasets/ICML2014/) |
| 12 | **ProteinConformers**: بنچمارک conformational landscape | 12 | [auroua/ProteinConformers](https://github.com/auroua/ProteinConformers) | داخل ریپو / طبق README |
| 13 | **OPI**: Open Protein Instructions (دیتاست instruction برای LLM) | 11 | [ocx-lab/opi](https://github.com/ocx-lab/opi) | [Hugging Face BAAI/OPI](https://huggingface.co/datasets/BAAI/OPI) |
| 14 | **MHC peptides**: ۸۶ هزار پپتید و میزان اتصال به MHC | 4 | [ditekunov/mhc-peptides-dataset](https://github.com/ditekunov/mhc-peptides-dataset) | داخل ریپو |
| 15 | **MPLID**: برهم‌کنش پروتئین غشایی–لیپید | 2 | [omagebright/MPLID](https://github.com/omagebright/MPLID) | [Zenodo](https://doi.org/10.5281/zenodo.18487584) |
| 16 | **PEER**: بنچمارک ۱۷ وظیفه‌ای (عملکرد، مکان‌یابی، ساختار، PPI، پروتئین–لیگاند) | — | [DeepGraphLearning/PEER_Benchmark](https://github.com/DeepGraphLearning/PEER_Benchmark) | طبق README (بر پایه‌ی TorchDrug) |
| 17 | **ProteinNet**: split استاندارد بر اساس CASP7 تا CASP12 | — | [aqlaboratory/proteinnet](https://github.com/aqlaboratory/proteinnet) | طبق README |
| 18 | **Mol-Instructions**: دیتاست instruction برای مولکول، پروتئین و متن زیستی | — | [zjunlp/Mol-Instructions](https://github.com/zjunlp/Mol-Instructions) | `load_dataset("zjunlp/Mol-Instructions", "Protein-oriented Instructions")` · [Hugging Face](https://huggingface.co/datasets/zjunlp/Mol-Instructions) |

## 2. پروتئین–لیگاند و کشف دارو

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **TDC (Therapeutics Data Commons)**: بیش از ۶۰ دیتاست ADMET، DTI، تولید مولکول و... | 1301 | [mims-harvard/TDC](https://github.com/mims-harvard/TDC) | `pip install PyTDC` ← `from tdc.single_pred import ADME; ADME(name='Caco2_Wang')` · [Harvard Dataverse](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/21LKWG) · [tdcommons.ai](https://tdcommons.ai) |
| 2 | **DeepPurpose datasets**: DAVIS، KIBA، BindingDB و داده‌های ضدویروسی | 1203 | [kexinhuang12345/DeepPurpose](https://github.com/kexinhuang12345/DeepPurpose) | `pip install DeepPurpose` ← `from DeepPurpose import dataset; dataset.load_process_DAVIS('./data')` |
| 3 | **PLINDER**: برهم‌کنش پروتئین–لیگاند | 320 | [plinder-org/plinder](https://github.com/plinder-org/plinder) | [Cameo file server](https://cameo3d.org/plinder/PLINDER-2026-09/) · `pip install plinder && plinder_download --release 2026-09` |
| 4 | **Protein-Ligand Benchmark (OpenFF)**: محاسبات انرژی آزاد | 247 | [openforcefield/protein-ligand-benchmark](https://github.com/openforcefield/protein-ligand-benchmark) | [Zenodo](https://doi.org/10.5281/zenodo.4813735) |
| 5 | **FS-Mol**: یادگیری few-shot روی مولکول‌ها | 177 | [microsoft/FS-Mol](https://github.com/microsoft/FS-Mol) | [Figshare](https://figshare.com/projects/FS-Mol_Dataset_and_Models/125797) |
| 6 | **Runs N' Poses**: بنچمارک co-folding پروتئین–لیگاند | 95 | [plinder-org/runs-n-poses](https://github.com/plinder-org/runs-n-poses) | [Zenodo](https://doi.org/10.5281/zenodo.14794785) · [Polaris](https://polarishub.io/datasets/plinder-org/runs-n-poses-dataset) |
| 7 | **HiQBind**: کمپلکس‌های پروتئین–لیگاند با کیفیت بالا | 91 | [THGLab/HiQBind](https://github.com/THGLab/HiQBind) | [Figshare](https://doi.org/10.6084/m9.figshare.27430305) |
| 8 | **BigBind / BayesBind** | 21 | [molecularmodelinglab/bigbind](https://github.com/molecularmodelinglab/bigbind) | [BigBindV1](https://storage.googleapis.com/bigbind/BigBindV1.tar.bz2) (لینک‌های V1.5 و BayesBind داخل README ریپو در زمان بررسی 404 دادند) |
| 9 | **SIU**: یک میلیون برهم‌کنش ساختاری مولکول کوچک–پروتئین | 17 | [bowen-gao/SIU](https://github.com/bowen-gao/SIU) | [Hugging Face](https://huggingface.co/datasets/bgao95/SIU) |
| 10 | **PROTAC degradation**: داده‌های تخریب هدفمند پروتئین | 17 | [AstraZeneca/Machine-Learning-for-Predicting-Targeted-Protein-Degradation](https://github.com/AstraZeneca/Machine-Learning-for-Predicting-Targeted-Protein-Degradation) | داخل ریپو |
| 11 | **PLUMB**: بنچمارک force field و انرژی آزاد | 12 | [omsf/plumb](https://github.com/omsf/plumb) | داخل ریپو (لینک Zenodo هنوز منتشر نشده) |
| 12 | **GuacaMol**: بنچمارک طراحی مولکول (حدود ۱.۶ میلیون SMILES از ChEMBL 24 و ۲۵ وظیفه) | — | [BenevolentAI/guacamol](https://github.com/BenevolentAI/guacamol) | [Figshare](https://figshare.com/projects/GuacaMol/56639) |
| 13 | **MOSES**: بنچمارک تولید مولکول (حدود ۱.۹ میلیون SMILES از ZINC) | — | [molecularsets/moses](https://github.com/molecularsets/moses) | داخل ریپو / طبق README |
| 14 | **GEOM**: GEOM-Drugs و GEOM-QM9 (کانفورمرهای سه‌بعدی) | — | [learningmatter-mit/geom](https://github.com/learningmatter-mit/geom) | [Harvard Dataverse](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/JNGTDF) |
| 15 | **PoseBusters**: بنچمارک اعتبار poseهای پروتئین–لیگاند (V1: ۴۲۸، V2: ۳۰۸ کمپلکس) | — | [maabuu/posebusters](https://github.com/maabuu/posebusters) | `pip install posebusters` · [Zenodo 8278563](https://zenodo.org/records/8278563) |
| 16 | **PMO / mol_opt**: بنچمارک بهینه‌سازی مولکول (۲۳ وظیفه‌ی oracle) | — | [wenhao-gao/mol_opt](https://github.com/wenhao-gao/mol_opt) | داخل ریپو |
| 17 | **Papyrus**: حدود ۶۰ میلیون نقطه‌ی bioactivity | — | [OlivierBeq/Papyrus-scripts](https://github.com/OlivierBeq/Papyrus-scripts) | `pip install papyrus-scripts` ← `papyrus download -V latest` · [Zenodo](https://zenodo.org/records/7377161) |
| 18 | **Polaris**: پلتفرم بنچمارک (شامل چالش ASAP Antiviral 2025) | — | [polaris-hub/polaris](https://github.com/polaris-hub/polaris) | `pip install polaris-lib` ← `polaris login` ← `po.load_dataset(...)` |
| 19 | **Tartarus**: بنچمارک طراحی معکوس مولکول و مواد | — | [aspuru-guzik-group/Tartarus](https://github.com/aspuru-guzik-group/Tartarus) | داخل ریپو |
| 20 | **DOCKSTRING**: بنچمارک داکینگ | — | [dockstring/dockstring](https://github.com/dockstring/dockstring) | [Figshare](https://figshare.com/s/95f2fed733dec170b998) |
| 21 | **MARCEL**: بنچمارک مجموعه‌ی کانفورمرها (Drugs-75K، Kraken، BDE، EE) | — | [SXKDZ/MARCEL](https://github.com/SXKDZ/MARCEL) | طبق README |
| 22 | **MolData**: ۱۲۵۵ وظیفه‌ی bioassay | — | [LumosBio/MolData](https://github.com/LumosBio/MolData) | داخل ریپو |
| 23 | **PoseCheck**: ارزیابی poseهای تولیدشده | — | [cch1999/posecheck](https://github.com/cch1999/posecheck) | طبق README |

## 3. برهم‌کنش پروتئین–پروتئین (PPI)

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **PINDER**: Protein INteraction Dataset and Evaluation Resource | 160 | [pinder-org/pinder](https://github.com/pinder-org/pinder) | `pip install pinder` ([راهنما](https://pinder-org.github.io/pinder/)) |
| 2 | **PIPR / seq_ppi**: PPI مبتنی بر توالی | 116 | [muhaochen/seq_ppi](https://github.com/muhaochen/seq_ppi) | داخل ریپو |
| 3 | **PPIRef**: PPIهای سه‌بعدی | 110 | [anton-bushuiev/PPIRef](https://github.com/anton-bushuiev/PPIRef) | [Zenodo](https://doi.org/10.5281/zenodo.14845086) |
| 4 | **DIPS-Plus**: ساختارهای پروتئینی برهم‌کنش‌کننده برای پیش‌بینی interface | 56 | [BioinfoMachineLearning/DIPS-Plus](https://github.com/BioinfoMachineLearning/DIPS-Plus) | [Zenodo 5134732](https://zenodo.org/record/5134732) · [Zenodo 8140981](https://zenodo.org/record/8140981) |

## 4. ژنومیکس و DNA

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **Genomic Benchmarks**: طبقه‌بندی توالی‌های ژنومی | 185 | [ML-Bioinfo-CEITEC/genomic_benchmarks](https://github.com/ML-Bioinfo-CEITEC/genomic_benchmarks) | `pip install genomic-benchmarks` · [پوشه‌ی datasets](https://github.com/ML-Bioinfo-CEITEC/genomic_benchmarks/tree/main/datasets) |
| 2 | **Genomic-FM**: دیتاست بزرگ برای بنچمارک مدل‌های پایه‌ی ژنومی | 33 | [bowang-lab/genomic-FM](https://github.com/bowang-lab/genomic-FM) | [Zenodo](https://zenodo.org/records/11502840) · `python download_data.py` (حدود ۳۰ گیگابایت) |
| 3 | **AFGR**: African Functional Genomics Resource | 9 | [smontgomlab/AFGR](https://github.com/smontgomlab/AFGR) | لینک‌های Dropbox داخل README ([نمونه](https://www.dropbox.com/sh/fikqu51rkxco2ra/AAAz9c-wnxuL_8BHxhzQUN7Ia?dl=0)) |
| 4 | **GUE / GUE+** (DNABERT-2): ۲۸ دیتاست در ۷ وظیفه و ۴ گونه | — | [MAGICS-LAB/DNABERT_2](https://github.com/MAGICS-LAB/DNABERT_2) | لینک Google Drive داخل README |
| 5 | **BEND**: ۷ وظیفه (ژن، enhancer، دسترس‌پذیری کروماتین، متیلاسیون، اثر واریانت) | — | [frederikkemarin/BEND](https://github.com/frederikkemarin/BEND) | لینک sid.erda.dk داخل README |
| 6 | **DART-Eval**: بنچمارک DNA تنظیمی در ۵ سطح | — | [kundajelab/DART-Eval](https://github.com/kundajelab/DART-Eval) | Synapse/ENCODE طبق README |
| 7 | **Basenji2 / Enformer / Borzoi**: داده‌ی آموزش مدل‌های توالی | — | [calico/basenji](https://github.com/calico/basenji) | `gs://basenji_barnyard/data` (requester-pays) · Borzoi: `gs://borzoi-paper` |
| 8 | **gReLU**: فریم‌ورک و model zoo مدل‌های توالی | — | [Genentech/gReLU](https://github.com/Genentech/gReLU) | `pip install gReLU` (داده در W&B artifacts) |

## 5. تک‌سلولی (Single-cell) و ترانسکریپتومیکس فضایی

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **Open Problems in Single-Cell**: دیتاست‌های بنچمارک | 443 | [openproblems-bio/openproblems](https://github.com/openproblems-bio/openproblems) | [openproblems.bio/datasets](https://openproblems.bio/datasets) |
| 2 | **Tabula Muris**: اطلس تک‌سلولی موش | 203 | [czbiohub-sf/tabula-muris](https://github.com/czbiohub-sf/tabula-muris) | [Figshare FACS](https://figshare.com/articles/Single-cell_RNA-seq_data_from_Smart-seq2_sequencing_of_FACS_sorted_cells/5715040) · [Figshare droplet](https://figshare.com/articles/Single-cell_RNA-seq_data_from_microfluidic_emulsion/5715025) |
| 3 | **sc-pert**: دیتاست‌های perturbation تک‌سلولی (Norman، Dixit، Frangieh، McFarland و...) | 186 | [theislab/sc-pert](https://github.com/theislab/sc-pert) | نوت‌بوک‌های دانلود در [datasets/](https://github.com/theislab/sc-pert/tree/main/datasets) |
| 4 | **Lung adenocarcinoma single-cell** | 155 | [czbiohub-sf/scell_lung_adenocarcinoma](https://github.com/czbiohub-sf/scell_lung_adenocarcinoma) | طبق README |
| 5 | **CELLxGENE Census**: ده‌ها میلیون سلول انسان و موش | 130 | [chanzuckerberg/cellxgene-census](https://github.com/chanzuckerberg/cellxgene-census) | `pip install cellxgene-census` · [cellxgene.cziscience.com](https://cellxgene.cziscience.com/) (کد نمونه در DATABASES.md) |
| 6 | **COVID-19 scRNA-seq و immune repertoire**: فهرست دیتاست‌ها | 46 | [immunomind/covid19](https://github.com/immunomind/covid19) | لینک‌های GEO، SRA، Synapse و Mendeley داخل README |
| 7 | **st_datasets**: ترانسکریپتومیکس فضایی با annotation | 14 | [hannshu/st_datasets](https://github.com/hannshu/st_datasets) | [Hugging Face](https://huggingface.co/datasets/han-shu/st_datasets) |
| 8 | **TENxVisiumData**: دیتاست‌های 10x Visium (پکیج Bioconductor) | 8 | [HelenaLC/TENxVisiumData](https://github.com/HelenaLC/TENxVisiumData) | `BiocManager::install("TENxVisiumData")` · [10x datasets](https://support.10xgenomics.com/spatial-gene-expression/datasets) |
| 9 | **st-visium-datasets**: Visium به شکل Hugging Face datasets | 1 | [obendidi/st-visium-datasets](https://github.com/obendidi/st-visium-datasets) | `load_visium_dataset("human")` |
| 10 | **scGPT corpus**: پیش‌آموزش روی حدود ۳۳ میلیون سلول CELLxGENE | — | [bowang-lab/scGPT](https://github.com/bowang-lab/scGPT) | طبق README |
| 11 | **cz-benchmarks**: بنچمارک مدل‌های virtual cell (CZI) | — | [chanzuckerberg/cz-benchmarks](https://github.com/chanzuckerberg/cz-benchmarks) | طبق README |

## 6. گراف دانش و شبکه‌های زیستی

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **OGB**: شامل `ogbn-proteins`، `ogbl-biokg`، `ogbl-ppa`، `ogbl-ddi`، `ogbg-molhiv` | 2103 | [snap-stanford/ogb](https://github.com/snap-stanford/ogb) | `pip install ogb` ← `PygNodePropPredDataset(name='ogbn-proteins')` (دانلود خودکار) |
| 2 | **PrimeKG**: گراف دانش پزشکی دقیق | 841 | [mims-harvard/PrimeKG](https://github.com/mims-harvard/PrimeKG) | [kg.csv از Dataverse](https://dataverse.harvard.edu/api/access/datafile/6180620) · [صفحه‌ی Dataverse](https://dataverse.harvard.edu/citation?persistentId=doi:10.7910/DVN/IYNGEV) |
| 3 | **DRKG**: گراف دانش بازکاربرد دارو | 705 | [gnn4dr/DRKG](https://github.com/gnn4dr/DRKG) | [drkg.tar.gz](https://dgl-data.s3-us-west-2.amazonaws.com/dataset/DRKG/drkg.tar.gz) |
| 4 | **Hetionet**: شبکه‌ی ناهمگن ۴۷ هزار گره و ۲.۲ میلیون یال | 366 | [hetio/hetionet](https://github.com/hetio/hetionet) | فایل‌های JSON/TSV/Neo4j در پوشه‌ی [hetnet/](https://github.com/hetio/hetionet/tree/main/hetnet) |
| 5 | **BioNEV**: شبکه‌های زیست‌پزشکی برای graph embedding | 231 | [xiangyue9607/BioNEV](https://github.com/xiangyue9607/BioNEV) | داخل ریپو (پوشه‌ی data) |
| 6 | **CROssBAR**: گراف دانش یکپارچه‌ی زیست‌پزشکی | 33 | [cansyl/CROssBAR](https://github.com/cansyl/CROssBAR) | [CROssBAR API](https://www.ebi.ac.uk/Tools/crossbar/swagger-ui.html) |

## 7. سرطان و مولتی‌اومیکس بالینی

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **cBioPortal DataHub**: صدها مطالعه‌ی ژنومیکس سرطان (TCGA و غیره) | 218 | [cBioPortal/datahub](https://github.com/cBioPortal/datahub) | `git lfs install && git clone https://github.com/cBioPortal/datahub` · [cbioportal.org/datasets](https://www.cbioportal.org/datasets) |
| 2 | **cancer_data**: دانلودر یکپارچه‌ی DepMap/CCLE، GTEx، TCGA | 16 | [kevinhu/cancer_data](https://github.com/kevinhu/cancer_data) | [DepMap](https://depmap.org/portal/download/) · [GTEx](https://gtexportal.org/home/datasets) |
| 3 | **TCGA BRCA PAM50** | 3 | [malbiruk/tcga-brca-pam50-analysis](https://github.com/malbiruk/tcga-brca-pam50-analysis) | طبق README (داده‌ی خام از GDC) |
| 4 | **Oncology trial failures**: ۲۳ هزار کارآزمایی بالینی متوقف‌شده | 1 | [ThorfinnThor/oncology-trial-failures](https://github.com/ThorfinnThor/oncology-trial-failures) | داخل ریپو |

## 8. میکروبیوم و متاژنومیکس

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **GRUMP**: متابارکدینگ جهانی rRNA پلانکتون | 11 | [jcmcnch/Global-rRNA-Univeral-Metabarcoding-of-Plankton](https://github.com/jcmcnch/Global-rRNA-Univeral-Metabarcoding-of-Plankton) | [OSF](https://osf.io/57dpa/) · [Simons CMAP](https://simonscmap.com/catalog/datasets/GRUMP) |
| 2 | **Full16S sewage**: توالی کامل 16S rRNA فاضلاب | 0 | [loulanomics/Full16S_sewageDatabase](https://github.com/loulanomics/Full16S_sewageDatabase) | [ASV fasta](https://github.com/loulanomics/Full16S_sewageDatabase/raw/main/Files/Full16S_sewageDatabase_ASV.fasta.gz) · [ASV counts](https://raw.githubusercontent.com/loulanomics/Full16S_sewageDatabase/main/Files/Wastewater_full16S_ASV_counts.csv) · [ASV taxonomy](https://raw.githubusercontent.com/loulanomics/Full16S_sewageDatabase/main/Files/Wastewater_full16S_ASV_taxonomy.csv) |

## 9. RNA

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **ncRNA-deep**: دیتاست‌های طبقه‌بندی RNAهای غیرکدکننده | 16 | [bioinformatics-sannio/ncrna-deep](https://github.com/bioinformatics-sannio/ncrna-deep) | داخل ریپو |
| 2 | **siRNA data grabber**: بیش از ۱۸ هزار رکورد کارایی knockdown از ۱۰ منبع | 13 | [BrandonWalk/sirna-data-grabber](https://github.com/BrandonWalk/sirna-data-grabber) | `pip install sirna-data-grabber` ← `load_records()` |
| 3 | **lncRNA homologs** | 3 | [bioinformatics-sannio/lncrna-homologs](https://github.com/bioinformatics-sannio/lncrna-homologs) | داخل ریپو |

## 10. پاتولوژی و تصویربرداری زیستی

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **BCSS**: Breast Cancer Semantic Segmentation (TCGA) | 190 | [PathologyDataScience/BCSS](https://github.com/PathologyDataScience/BCSS) | [Google Drive 1](https://drive.google.com/drive/folders/1zqbdkQF8i5cEmZOGmbdQm-EP8dRYtvss?usp=sharing) · [Google Drive 2](https://drive.google.com/drive/folders/1mSd3ZG1lnno_RuTHQXSU0GRAhtR21yIy?usp=sharing) |
| 2 | **BSCCM**: Berkeley Single Cell Computational Microscopy | 22 | [Waller-Lab/BSCCM](https://github.com/Waller-Lab/BSCCM) | [Zenodo](https://zenodo.org/doi/10.5281/zenodo.10392182) |
| 3 | **JUMP-CP (cpg0016)**: Cell Painting برای حدود ۱۱۶ هزار ترکیب | — | [jump-cellpainting/datasets](https://github.com/jump-cellpainting/datasets) | `aws s3 ls --no-sign-request s3://cellpainting-gallery/cpg0016-jump/` |

## 11. متن زیست‌پزشکی (NLP) و بنچمارک‌های کدنویسی

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **IMCS-21**: بنچمارک مشاوره‌ی پزشکی خودکار | 73 | [lemuria-wchen/imcs21](https://github.com/lemuria-wchen/imcs21) | داخل ریپو |
| 2 | **BioCoder**: بنچمارک تولید کد بیوانفورماتیک | 59 | [gersteinlab/BioCoder](https://github.com/gersteinlab/BioCoder) | [Hugging Face](https://huggingface.co/datasets/lilbillbiscuit/biocoder_public) |
| 3 | **bioTaskBench**: بنچمارک وظایف بیوانفورماتیک | 16 | [GPTomics/bioTaskBench](https://github.com/GPTomics/bioTaskBench) | داخل ریپو |
| 4 | **PanCan-RE**: کورپوس روابط زیست‌پزشکی سرطان پانکراس | 0 | [MHD-AI-DS/PanCan-RE](https://github.com/MHD-AI-DS/PanCan-RE) | داخل ریپو |
| 5 | **MedQA**: سؤال‌های سبک USMLE | — | [jind11/MedQA](https://github.com/jind11/MedQA) | طبق README |
| 6 | **BigBio**: بیش از ۱۲۶ دیتاست زیست‌پزشکی با schema یکسان | — | [bigscience-workshop/biomedical](https://github.com/bigscience-workshop/biomedical) | `load_dataset("bigbio/<name>", name="<name>_bigbio_<schema>")` |
| 7 | **LAB-Bench**: حدود ۲۴۰۰ سؤال چندگزینه‌ای برای عامل‌های زیستی | — | [Future-House/LAB-Bench](https://github.com/Future-House/LAB-Bench) | [Hugging Face](https://huggingface.co/datasets/futurehouse/lab-bench) |
| 8 | **BioProBench**: درک پروتکل‌های آزمایشگاهی | — | [YuyangSunshine/bioprotocolbench](https://github.com/YuyangSunshine/bioprotocolbench) | طبق README |

## 12. فهرست‌های گردآوری‌شده (Awesome lists)

این ریپوها خودشان صدها لینک دیتاست یا دیتابیس دیگر دارند:

| # | فهرست | ⭐ | ریپازیتوری |
|---|---|---|---|
| 1 | Awesome Bioinformatics | 4369 | [danielecook/Awesome-Bioinformatics](https://github.com/danielecook/Awesome-Bioinformatics) |
| 2 | Awesome bioinformatics benchmarks | 368 | [j-andrews7/awesome-bioinformatics-benchmarks](https://github.com/j-andrews7/awesome-bioinformatics-benchmarks) |
| 3 | Awesome drug discovery knowledge graphs | 275 | [AstraZeneca/awesome-drug-discovery-knowledge-graphs](https://github.com/AstraZeneca/awesome-drug-discovery-knowledge-graphs) |
| 4 | Awesome structural bioinformatics | 81 | [twoXes/awesome-structural-bioinformatics](https://github.com/twoXes/awesome-structural-bioinformatics) |
| 5 | BioMedical NLP corpus | 63 | [zonghui0228/BioMedical-NLP-corpus](https://github.com/zonghui0228/BioMedical-NLP-corpus) |
| 6 | Awesome AI + Bioinformatics | 59 | [HongxinXiang/awesome-ai-bioinformatics](https://github.com/HongxinXiang/awesome-ai-bioinformatics) |
| 7 | Awesome spatial transcriptomics | 58 | [wrab12/awesome-spatial-transcriptomics](https://github.com/wrab12/awesome-spatial-transcriptomics) |
| 8 | Awesome bioinformatics formats | 54 | [kmhernan/awesome-bioinformatics-formats](https://github.com/kmhernan/awesome-bioinformatics-formats) |
| 9 | Public bioinformatics datasets | 47 | [JEFworks/public-bioinformatics-datasets](https://github.com/JEFworks/public-bioinformatics-datasets) |
| 10 | Awesome bioinformatics (databases, software…) | 47 | [WooGenome/awesome-bioinformatics](https://github.com/WooGenome/awesome-bioinformatics) |
| 11 | Awesome awesomeness bioinformatics | 46 | [Juke34/awesome-awesomeness-bioinformatics](https://github.com/Juke34/awesome-awesomeness-bioinformatics) |
| 12 | Awesome Genomic LLMs | 18 | [openlifescience-ai/Awesome-Genomic-LLMs](https://github.com/openlifescience-ai/Awesome-Genomic-LLMs) |
| 13 | Translational medicine multi-omics resources | 2 | [th86/transmeddatasets](https://github.com/th86/transmeddatasets) |
| 14 | Medical Dataset Hub (بر اساس ICD) | 1 | [burningvictor-lang/medical-dataset-hub](https://github.com/burningvictor-lang/medical-dataset-hub) |
| 15 | Awesome genomic bioinformatics (DBs + APIs) | 0 | [sanjeevi0078/awesome-genomic-bioinformatics](https://github.com/sanjeevi0078/awesome-genomic-bioinformatics) |
| 16 | Deep learning in biology | — | [hussius/deeplearning-biology](https://github.com/hussius/deeplearning-biology) |

## 13. دیتاست‌ها و بنچمارک‌های مقالات

دیتاست‌هایی که ریپوی GitHub مستقل ندارند یا اصلاً روی GitHub نیستند (Hugging Face، Kaggle، سایت چالش‌ها، Zenodo). ⭐ ندارند و به جای آن بر اساس **میزان استفاده** (۱۳.۲) یا **اهمیت** (۱۳.۱ و ۱۳.۳) مرتب شده‌اند.

### 13.1 بنچمارک‌ها و چالش‌های مهم

| # | دیتاست / بنچمارک | حوزه | آخرین نسخه یا دوره | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **CASP**: ارزیابی کور پیش‌بینی ساختار (دوسالانه) | ساختار پروتئین | CASP17 (فصل پیش‌بینی تمام شد؛ کنفرانس دسامبر ۲۰۲۶) | [download_area/CASP17](https://predictioncenter.org/download_area/CASP17/) |
| 2 | **CAFA**: پیش‌بینی عملکرد پروتئین (GO) | عملکرد پروتئین | CAFA6 روی Kaggle (اکتبر ۲۰۲۵) | `kaggle.com/competitions/cafa-6-protein-function-prediction` · [biofunctionprediction.org](https://www.biofunctionprediction.org/cafa/) |
| 3 | **CAMEO**: ارزیابی کور هفتگی (3D، QE، لیگاند) | ساختار | پیوسته | [cameo3d.org](https://cameo3d.org) |
| 4 | **Nucleotide Transformer downstream tasks (revised)**: ۱۸ وظیفه، حدود ۵۳۲ هزار ردیف (نسخه‌ی پیشنهادی به جای نسخه‌ی اصلی) | DNA | revised | `load_dataset("InstaDeepAI/nucleotide_transformer_downstream_tasks_revised")` |
| 5 | **Genomics Long-Range Benchmark (LRB)**: توالی تا حدود ۱۰۰ کیلوباز | DNA | 2024 | `load_dataset("InstaDeepAI/genomics-long-range-benchmark", task_name=..., sequence_length=...)` |
| 6 | **Tahoe-100M**: بیش از ۱۰۰ میلیون سلول، ۵۰ رده‌ی سلولی، حدود ۱۱۰۰ اختلال دارویی | تک‌سلولی | فوریه‌ی ۲۰۲۵ | `load_dataset("tahoebio/Tahoe-100M", streaming=True)` |
| 7 | **Virtual Cell Challenge** (Arc): ۲۰۲۵ با داده‌ی H1 hESC Perturb-seq (حدود ۳۰۰ هزار سلول). ۲۰۲۶ بدون داده‌ی آموزش (zero-shot روی ۶ رده‌ی سلولی) | اختلال تک‌سلولی | VCC 2026 | [Arc Virtual Cell Atlas](https://arcinstitute.org/tools/virtualcellatlas) · [VCC 2026](https://arcinstitute.org/news/virtual-cell-challenge-2026) |
| 8 | **scPerturb**: ۴۴ دیتاست اختلال هماهنگ‌شده (h5ad) | اختلال تک‌سلولی | رکوردهای Zenodo | [scperturb.org](https://scperturb.org) |
| 9 | **Replogle 2022 (State-Replogle-Filtered)**: CRISPRi روی K562 و RPE1 | اختلال تک‌سلولی | — | [HF arcinstitute/State-Replogle-Filtered](https://huggingface.co/datasets/arcinstitute/State-Replogle-Filtered) |
| 10 | **Genecorpus-30M** (Geneformer) | تک‌سلولی | — | [HF ctheodoris/Genecorpus-30M](https://huggingface.co/datasets/ctheodoris/Genecorpus-30M) |
| 11 | **MoleculeNet**: QM7/8/9، ESOL، FreeSolv، Lipophilicity، PCBA، HIV، BACE، BBBP، Tox21، ToxCast، SIDER، ClinTox | مولکول | 2018 (در DeepChem نگهداری می‌شود) | [moleculenet.org](https://moleculenet.org) · `deepchem.molnet.load_*` |
| 12 | **OpenADMET ExpansionRx Blind Challenge**: بیش از ۷۰۰۰ مولکول، ۹ endpoint از ADMET | ADMET | ۲۰۲۵–۲۶ | [HF openadmet/openadmet-expansionrx-challenge-train-data](https://huggingface.co/datasets/openadmet/openadmet-expansionrx-challenge-train-data) |
| 13 | **ASAP Discovery × Polaris Antiviral 2025** (ADMET، Potency، Ligand Poses) | کشف دارو | داده‌ی unblinded از نوامبر ۲۰۲۵ | دیتاست `asap-discovery/antiviral-potency-2025-unblinded` در [Polaris](https://polaris-hub.vercel.app/datasets/asap-discovery/antiviral-potency-2025-unblinded) |
| 14 | **LIT-PCBA**: ۱۵ هدف از PubChem (گزارش‌هایی از نشت داده هست) | غربالگری مجازی | 2020 | [drugdesign.unistra.fr/LIT-PCBA](https://drugdesign.unistra.fr/LIT-PCBA/) |
| 15 | **PDBbind / CASF-2016** (۲۸۵ کمپلکس core set) | پروتئین–لیگاند | v2020 آخرین نسخه‌ی رایگان | [pdbbind-plus.org.cn](https://www.pdbbind-plus.org.cn) |
| 16 | **DUD-E** (۱۰۲ هدف) و **DEKOIS 2.0** (۸۱ هدف) | غربالگری مجازی | 2012 | [dude.docking.org](https://dude.docking.org) · [dekois.com](http://www.dekois.com/) |
| 17 | **BELKA** (Leash Bio): حدود ۱۳۳ میلیون مولکول DEL | اتصال مولکول | Kaggle 2024 | `kaggle.com/competitions/leash-BELKA` |
| 18 | **mdCATH**: ۵۳۹۸ دامنه‌ی CATH، ۵ دما × ۵ تکرار (حدود ۳ ترابایت) | دینامیک مولکولی | 2024 | [HF compsciencelab/mdCATH](https://huggingface.co/datasets/compsciencelab/mdCATH) |
| 19 | **ATLAS MD**: حدود ۱۳۹۰ زنجیره، ۳×۱۰۰ نانوثانیه | دینامیک مولکولی | 2024 | [dsimb.inserm.fr/ATLAS](https://www.dsimb.inserm.fr/ATLAS) |
| 20 | **SAbDab** و **OAS** | آنتی‌بادی | SAbDab هفتگی | [SAbDab](https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/sabdab) · [OAS](https://opig.stats.ox.ac.uk/webapps/oas/) |
| 21 | **BioLiP2**: محل اتصال لیگاند–پروتئین (هفتگی) | پروتئین–لیگاند | پیوسته | [zhanggroup.org/BioLiP](https://zhanggroup.org/BioLiP/) |
| 22 | **CAGI**: تفسیر ژنوم (CAGI1 تا CAGI7) | واریانت | CAGI7 (۲۰۲۴–۲۵) | [genomeinterpretation.org](https://genomeinterpretation.org) |
| 23 | **DREAM Challenges** (مثلاً Random Promoter DREAM 2022 با حدود ۶.۷ میلیون پروموتر) | چندگانه | — | [dreamchallenges.org](https://dreamchallenges.org) |
| 24 | **DeepSEA / Sei**: ۹۱۹ ویژگی کروماتین (Sei: ۲۱٬۹۰۷) | DNA تنظیمی | 2015 | `deepsea_train_bundle.v0.9.tar.gz` (آدرس تأیید نشد) |
| 25 | **BixBench**: بیش از ۵۰ سناریوی تحلیل و حدود ۳۰۰ سؤال برای عامل‌های AI | عامل‌های بیوانفورماتیک | 2025 (+ Verified-50) | [HF futurehouse/BixBench](https://huggingface.co/datasets/futurehouse/BixBench) |
| 26 | **LABBench2**: ۱۸۹۲ وظیفه در ۱۱ دسته | عامل‌های زیستی | 2026 | [arXiv 2604.09554](https://arxiv.org/pdf/2604.09554) |
| 27 | **PubMedQA** و **BLURB** و **BioASQ** | NLP زیست‌پزشکی | BioASQ 13 (۲۰۲۵) | [pubmedqa.github.io](https://pubmedqa.github.io) · [BLURB](https://microsoft.github.io/BLURB/) · [bioasq.org](http://bioasq.org) |
| 28 | **CAMELYON16/17**: اسلایدهای متاستاز غدد لنفاوی | پاتولوژی | — | [camelyon17.grand-challenge.org](https://camelyon17.grand-challenge.org) · `s3://camelyon-dataset` |
| 29 | **PANDA**: حدود ۱۱ هزار WSI پروستات | پاتولوژی | Kaggle 2020 | `kaggle.com/c/prostate-cancer-grade-assessment` |
| 30 | **LIVECell**: حدود ۱.۶ میلیون سلول | میکروسکوپی | 2021 | [sartorius-research.github.io/LIVECell](https://sartorius-research.github.io/LIVECell/) |
| 31 | **RxRx1 / RxRx2 / RxRx3 / RxRx3-core** | Cell painting | — | [rxrx.ai/datasets](https://www.rxrx.ai/datasets) · HF `recursionpharma/rxrx3-core` |
| 32 | **MoNuSeg** و **PanNuke** (۷۹۰۴ patch، ۱۹ بافت) | پاتولوژی | — | [monuseg.grand-challenge.org](https://monuseg.grand-challenge.org) · warwick.ac.uk/fac/cross_fac/tia/data/pannuke |
| 33 | **مسابقات زیستی Kaggle**: Stanford RNA 3D Folding Part 2 (۲۰۲۶)، Ribonanza، Novozymes enzyme stability، Open Problems multimodal و perturbation، CZII cryo-ET، HuBMAP، HPA، Echoes of Silenced Genes (۲۰۲۶) | چندگانه | — | `kaggle competitions list -s <term>` |

### 13.2 دیتاست‌های مقالات طراحی مولکول با یادگیری عمیق

برای این بخش، فهرست [AspirinCode/papers-for-molecular-design-using-DL](https://github.com/AspirinCode/papers-for-molecular-design-using-DL) بررسی شد: ۱٬۲۸۰ مدخل، ۸۷۷ مقاله‌ی یکتا و ۵۴۷ ریپو. از این‌ها ۵۲۲ README و ۶۳ چکیده‌ی arXiv خوانده شد و ۶۳۴ مقاله (۷۲٪) پوشش داده شد. ستون «مقاله‌ها» تعداد مقاله‌هایی از این فهرست است که دیتاست را استفاده کرده‌اند.

> **محدودیت‌ها:**
> - نام دیتاست از README کد استخراج شده، پس دیتاستی که فقط در متن مقاله آمده باشد شمرده نشده است.
> - ستون «نسخه‌ها» تعداد دفعات ذکر هر نسخه را نشان می‌دهد، نه تعداد مقاله‌ها را.
> - رشته‌هایی مثل «ChEMBL 02» از نام فایل آمده‌اند و نسخه‌ی واقعی نیستند. نسخه‌های واقعی ChEMBL که استفاده شده‌اند ۲۱ تا ۳۷ هستند.

| # | دیتاست | حوزه | مقاله‌ها | نسخه‌ها | دانلود | مجوز |
|---|---|---|---|---|---|---|
| 1 | **ZINC** | مولکول کوچک | 89 | ZINC250k (91 بار)، 15 (17)، 20 (10)، 22 (7) | [zinc.docking.org](https://zinc.docking.org/) · [ZINC250k](https://github.com/aspuru-guzik-group/chemical_vae) | آکادمیک غیرتجاری |
| 2 | **ChEMBL** | bioactivity | 83 | 22 و 31 رایج‌ترین؛ 35 و 36 در کارهای ۲۰۲۵–۲۶ (آخرین: 37) | [FTP](https://ftp.ebi.ac.uk/pub/databases/chembl/) | CC BY-SA 3.0 |
| 3 | **CrossDocked2020** | پروتئین–لیگاند | 64 | v1.1 (21 بار؛ split استاندارد ۱۰۰ هزار آموزش و ۱۰۰ تست) | [bits.csb.pitt.edu](https://bits.csb.pitt.edu/files/crossdock2020/) | باز (Koes lab) |
| 4 | **QM9** | کوانتومی | 52 | زیرمجموعه‌ی GDB-17 | [Figshare](https://figshare.com/collections/Quantum_chemistry_structures_and_properties_of_134_kilo_molecules/978904) | CC0 |
| 5 | **MOSES** | بنچمارک تولید | 47 | یک انتشار | [molecularsets/moses](https://github.com/molecularsets/moses) | MIT |
| 6 | **GEOM** (Drugs / QM9) | کانفورمر سه‌بعدی | 34 | drugs (107 بار)، qm9 (9) | [Dataverse](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/JNGTDF) | CC0 |
| 7 | **GuacaMol** | بنچمارک تولید | 30 | v1 (ChEMBL 24) | [BenevolentAI/guacamol](https://github.com/BenevolentAI/guacamol) | MIT (کد) |
| 8 | **PDBbind** | پروتئین–لیگاند | 19 | 2020 (28 بار)، 2016 (12) | [pdbbind-plus.org.cn](https://www.pdbbind-plus.org.cn/) | آکادمیک؛ نسخه‌ی جدید پولی |
| 9 | **PubChem** | bioassay | 19 | پیوسته | [pubchem.ncbi.nlm.nih.gov](https://pubchem.ncbi.nlm.nih.gov/) | عمومی |
| 10 | **Enamine REAL** | make-on-demand | 14 | REAL Space (۶ تا بیش از ۳۸ میلیارد) | [enamine.net](https://enamine.net/compound-collections/real-compounds) | غربالگری آکادمیک رایگان |
| 11 | **PoseBusters** | اعتبار pose | 12 | Benchmark set (۴۲۸) | [maabuu/posebusters](https://github.com/maabuu/posebusters) | BSD-3-Clause |
| 12 | **Binding MOAD** | پروتئین–لیگاند | 10 | 2020، 2022 | [bindingmoad.org](http://bindingmoad.org/) | آکادمیک |
| 13 | **BindingDB** | affinity | 7 | ماهانه | [bindingdb.org](https://www.bindingdb.org/) | CC BY 3.0 US |
| 14 | **GDB-11/13/17/20** | فضای شیمیایی | 7 | GDB-20 (۲۰۲۶، در مقیاس تریلیون) | [gdb.unibe.ch](https://gdb.unibe.ch/downloads/) | آکادمیک |
| 15 | **PMO / mol_opt** | بهینه‌سازی | 7 | NeurIPS 2022 | [wenhao-gao/mol_opt](https://github.com/wenhao-gao/mol_opt) | MIT |
| 16 | **RCSB PDB** | ساختار | 7 | split بر اساس تاریخ snapshot | [rcsb.org](https://www.rcsb.org/) | CC0 |
| 17 | **TDC** | چندحوزه‌ای | 7 | TDC-1 / TDC-2 | [mims-harvard/TDC](https://github.com/mims-harvard/TDC) | MIT + مجوز هر دیتاست |
| 18 | **DrugBank** | داروهای تأییدشده | 6 | 5.x | [go.drugbank.com](https://go.drugbank.com/) | CC BY-NC 4.0 |
| 19 | **Materials Project / MP-20** | مواد | 6 | MP-20 (۴۵٬۲۳۱ ساختار) | [materialsproject.org](https://next-gen.materialsproject.org/) · [cdvae](https://github.com/txie-93/cdvae) | CC BY 4.0 |
| 20 | **MoleculeNet** | بنچمارک | 6 | 2018 | [moleculenet.org](https://moleculenet.org/) | MIT |
| 21 | **PCBA** | bioassay | 6 | PCBA-128 | [moleculenet.org](https://moleculenet.org/datasets-1) | MIT |
| 22 | **USPTO** | واکنش | 6 | 50k، MIT (480k)، full (حدود ۱ میلیون)، STEREO، 1k-TPL | [Figshare (Lowe)](https://figshare.com/articles/dataset/Chemical_reactions_from_US_patents_1976-Sep2016_/5104873) | CC0 |
| 23 | **ChEBI-20 / L+M-24** | متن–مولکول | 5 | ChEBI-20 (۳۳٬۰۱۰ جفت) | [blender-nlp/MolT5](https://github.com/blender-nlp/MolT5) | CC BY 4.0 / MIT |
| 24 | **ExCAPE-DB** | bioactivity | 5 | v2 | [Zenodo 2543724](https://zenodo.org/records/2543724) | CC BY-SA 4.0 |
| 25 | **PoseCheck** | ارزیابی pose | 5 | 2023 | [cch1999/posecheck](https://github.com/cch1999/posecheck) | MIT |
| 26 | **Mol-Instructions** | instruction برای LLM | 5 | v1 / v2 | [zjunlp/Mol-Instructions](https://github.com/zjunlp/Mol-Instructions) | CC BY 4.0 |
| 27 | **UniProt / Swiss-Prot** | توالی پروتئین | 5 | مثلاً 2023_05 (آخرین: 2026_04) | [uniprot.org](https://www.uniprot.org/) | CC BY 4.0 |
| 28 | **CASF-2016** | scoring | 4 | 2007، 2013، 2016 | از طریق PDBbind+ | آکادمیک |
| 29 | **DUD-E** | غربالگری مجازی | 4 | 2012 | [dude.docking.org](https://dude.docking.org/) | آکادمیک |
| 30 | **LINCS L1000** | ترانسکریپتومیکس | 4 | GSE92742، GSE70138 | [clue.io/data](https://clue.io/data) | CC BY 4.0 |
| 31 | **LIT-PCBA** | غربالگری مجازی | 4 | 2020 | [drugdesign.unistra.fr](https://drugdesign.unistra.fr/LIT-PCBA/) | آکادمیک |
| 32 | **MARCEL** | کانفورمر | 3 | 2023 | [SXKDZ/MARCEL](https://github.com/SXKDZ/MARCEL) | MIT |
| 33 | **QMugs** | کوانتومی | 3 | 1.0 | [ETH Research Collection](https://www.research-collection.ethz.ch/handle/20.500.11850/482129) | CC BY 4.0 |
| 34 | **RAbD / IgFold** | آنتی‌بادی | 2 | RAbD (۶۰ کمپلکس) | [RAbD_benchmark](https://github.com/RosettaCommons/RAbD_benchmark) · [IgFold](https://github.com/Graylab/IgFold) | آکادمیک |
| 35 | **DAVIS** | kinase affinity | 2 | 2011 | [TDC DTI](https://tdcommons.ai/multi_pred_tasks/dti/) | باز (TDC) |
| 36 | **DOCKSTRING** | داکینگ | 2 | 2022 | [dockstring/dockstring](https://github.com/dockstring/dockstring) | MIT (کد) |
| 37 | **KIBA** | kinase affinity | 2 | 2014 (نسخه‌ی فیلترشده) | [TDC DTI](https://tdcommons.ai/multi_pred_tasks/dti/) | باز (TDC) |
| 38 | **MolData** | bioassay | 2 | 2022 | [LumosBio/MolData](https://github.com/LumosBio/MolData) | MIT |
| 39 | **Molecule3D / Drugs-75K** | سه‌بعدی | 2 | Molecule3D (۳.۹ میلیون) | [MoleculeX](https://github.com/divelab/MoleculeX) · [MolDiff](https://github.com/pengxingang/MolDiff) | GPL-3.0 / MIT |
| 40 | **PubChemQC** | کوانتومی | 2 | PM6، B3LYP | [pubchemqc.riken.jp](http://pubchemqc.riken.jp/) | CC BY 4.0 |
| 41 | **SAbDab** | آنتی‌بادی | 2 | هفتگی | [SAbDab](https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/sabdab) | آکادمیک |
| 42 | **NIST / MassBank / GNPS** | طیف جرمی | 2 | NIST 17/20/23 (تجاری) | [massbank.eu](https://massbank.eu/) · [gnps.ucsd.edu](https://gnps.ucsd.edu/) | CC BY / تجاری |
| 43 | **SureChEMBL** | پتنت | 2 | پیوسته | [surechembl.org](https://www.surechembl.org/) | CC BY-SA 3.0 |
| 44 | **Tartarus** | بنچمارک | 2 | 2022/2023 | [aspuru-guzik-group/Tartarus](https://github.com/aspuru-guzik-group/Tartarus) | MIT |
| 45 | **Alex-MP-20 / Alexandria** | مواد | 1 | حدود ۶۰۰ هزار ساختار | [alexandria.icams.rub.de](https://alexandria.icams.rub.de/) · [mattergen](https://github.com/microsoft/mattergen) | CC BY 4.0 |
| 46 | **AlphaFold DB** | ساختار پیش‌بینی‌شده | 1 | v4 (آخرین: v6) | [alphafold.ebi.ac.uk](https://alphafold.ebi.ac.uk/) | CC BY 4.0 |
| 47 | **CATH** | پروتئین | 1 | split ۴۰٪ نسخه‌ی 4.2 (آخرین: 4.4) | [cathdb.info](https://www.cathdb.info/) | CC BY 4.0 |
| 48 | **GDSC** | فارماکوژنومیکس | 1 | GDSC1 / GDSC2 | [cancerrxgene.org](https://www.cancerrxgene.org/) | CC BY-NC |
| 49 | **IZA zeolite** | مواد | 1 | — | [iza-structure.org](https://www.iza-structure.org/databases/) | آکادمیک |
| 50 | **OAS** | توالی آنتی‌بادی | 1 | بازسازی ۲۰۲۱ | [OAS](https://opig.stats.ox.ac.uk/webapps/oas/) | آکادمیک |
| 51 | **Papyrus** | bioactivity | 1 | 05.5 / 05.6 | [Zenodo](https://zenodo.org/records/7377161) | CC BY 4.0 (داده) |
| 52 | **PepBDB** | پپتید–پروتئین | 1 | 2019 | [PepBDB](http://huanglab.phys.hust.edu.cn/pepbdb/) | آکادمیک |
| 53 | **Perov-5** | مواد | 1 | split نسخه‌ی CDVAE | [cdvae](https://github.com/txie-93/cdvae) | MIT |
| 54 | **DEKOIS 2.0** | غربالگری مجازی | 1 | 2.0 | [dekois.com](http://www.dekois.com/) | آکادمیک |
| 55 | **SKEMPI 2.0** | پروتئین–پروتئین | 1 | 2.0 | [life.bsc.es/pid/skempi2](https://life.bsc.es/pid/skempi2) | آکادمیک |
| 56 | **Tox21** | سمیت | 1 | Challenge set | [moleculenet.org](https://moleculenet.org/datasets-1) | عمومی (NIH) |
| 57 | **ZINC22** | make-on-demand | 1 | 2023 (بیش از ۳۷ میلیارد) | [cartblanche22.docking.org](https://cartblanche22.docking.org/) | آکادمیک |

### 13.3 بنچمارک‌ها و دیتاست‌های جدید معرفی‌شده در همان مقاله‌ها

| # | سال | دیتاست / بنچمارک | دانلود / کد |
|---|---|---|---|
| 1 | 2026 | **GDB-20**: پایگاه داده‌ی مولکول‌های دارومانند در مقیاس تریلیون | [reymond-group/GDB-ML](https://github.com/reymond-group/GDB-ML) · [Zenodo](https://doi.org/10.5281/zenodo.17368725) |
| 2 | 2026 | **MolGenBench**: ارزیابی SBDD از طراحی de novo تا بهینه‌سازی lead | [CAODH/MolGenBench](https://github.com/CAODH/MolGenBench) · [Zenodo](https://doi.org/10.5281/zenodo.21757787) |
| 3 | 2026 | **ScrambleBench**: کنترل با درهم‌ریختن pocket | [Feriolet/ScrambleBench](https://github.com/Feriolet/ScrambleBench) |
| 4 | 2026 | **بنچمارک SBDD یک‌بعدی، دوبعدی و سه‌بعدی** (Beyond Affinity) | [zkysfls/2025-sbdd-benchmark](https://github.com/zkysfls/2025-sbdd-benchmark) |
| 5 | 2026 | **PyMolGen**: پایگاه ترکیبات تولیدشده | [HirstGroup/PyMolGen](https://github.com/HirstGroup/PyMolGen) |
| 6 | 2025 | **بنچمارک طراحی معکوس پلیمر** | [ytl0410/Polymer-Generative-Models-Benchmark](https://github.com/ytl0410/Polymer-Generative-Models-Benchmark) |
| 7 | 2024 | **Durian**: بنچمارک تولید مولکول سه‌بعدی بر اساس ساختار | [19990210nd/Durian](https://github.com/19990210nd/Durian) |
| 8 | 2024 | **بنچمارک SBDD ۲۰۲۴** (Do 3D Methods Really Dominate?) | [zkysfls/2024-sbdd-benchmark](https://github.com/zkysfls/2024-sbdd-benchmark) |
| 9 | 2024 | **Bento**: بنچمارک داکینگ پروتئین–لیگاند | [LigandPro/Bento](https://github.com/LigandPro/Bento) |
| 10 | 2024 | **RediscMol**: بنچمارک کشف دوباره | [gaoqiweng/RediscMol](https://github.com/gaoqiweng/RediscMol) |
| 11 | 2023 | **smina docking benchmark** | [cieplinski-tobiasz/smina-docking-benchmark](https://github.com/cieplinski-tobiasz/smina-docking-benchmark) |
| 12 | 2023 | **GDB-13s**: فضای قطعه‌های زیست‌فعال | [Ye-Buehler/Molecule_Breakdown_Model](https://github.com/Ye-Buehler/Molecule_Breakdown_Model) |
| 13 | 2023 | **ConGen dataset**: تولید مولکول چندقیدی | [jpmailoa/ConGen_Dataset](https://github.com/jpmailoa/ConGen_Dataset) |
| 14 | 2021 | **دیتاست ترکیبات چندهدفی** | [tblaschke/reinvent-multi-target](https://github.com/tblaschke/reinvent-multi-target) |
