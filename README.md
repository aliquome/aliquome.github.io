# دیتاست‌های عمومی بیوانفورماتیک در GitHub

فهرست دیتاست‌های عمومی بیوانفورماتیک که روی GitHub منتشر شده‌اند. برای هر کدام لینک ریپازیتوری و لینک یا روش دانلود آمده است.

- دیتاست‌ها **بر اساس موضوع** دسته‌بندی شده‌اند و در هر دسته **بر اساس تعداد ستاره‌ی GitHub** (از زیاد به کم) مرتب هستند.
- ⭐ = تعداد ستاره در زمان جمع‌آوری (نوامبر ۲۰۲۶).
- همین فهرست به شکل جدول در [datasets.csv](datasets.csv) هم هست.
- دیتابیس‌های آنلاین (NCBI، UniProt، PDB، Ensembl، TCGA و...) و نحوه‌ی گرفتن داده از آن‌ها: [DATABASES.md](DATABASES.md)
- ابزارهای بیوانفورماتیکی که در همین جستجو پیدا شدند: [TOOLS.md](TOOLS.md)

> **روش جمع‌آوری:** جستجو در GitHub Search API با عبارت‌های `topic:bioinformatics topic:dataset(s)`، `bioinformatics dataset`، `genomics dataset`، `single-cell dataset`، `protein dataset` و `awesome bioinformatics` (۳۱۲ ریپو). ریپوهای ابزار از دیتاست‌ها جدا شدند. لینک‌های دانلود از README خود هر ریپو استخراج شده‌اند. چند دیتاست شناخته‌شده‌ی دیگر (TAPE، ProteinGym، OGB، DRKG و...) هم دستی اضافه شدند.
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

---

## 1. پروتئین: توالی، ساختار و عملکرد

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **TAPE**: بنچمارک یادگیری بازنمایی پروتئین (Pfam، ساختار ثانویه، Remote homology، Fluorescence، Stability) | 746 | [songlab-cal/tape](https://github.com/songlab-cal/tape) | [pfam](http://s3.amazonaws.com/songlabdata/proteindata/data_pytorch/pfam.tar.gz) · [secondary_structure](http://s3.amazonaws.com/songlabdata/proteindata/data_pytorch/secondary_structure.tar.gz) · [remote_homology](http://s3.amazonaws.com/songlabdata/proteindata/data_pytorch/remote_homology.tar.gz) · [fluorescence](http://s3.amazonaws.com/songlabdata/proteindata/data_pytorch/fluorescence.tar.gz) · [stability](http://s3.amazonaws.com/songlabdata/proteindata/data_pytorch/stability.tar.gz) · [proteinnet](http://s3.amazonaws.com/songlabdata/proteindata/data_pytorch/proteinnet.tar.gz) |
| 2 | **ProteinGym**: بنچمارک پیش‌بینی اثر واریانت‌ها (DMS) | 488 | [OATML-Markslab/ProteinGym](https://github.com/OATML-Markslab/ProteinGym) | [Hugging Face](https://huggingface.co/datasets/OATML-Markslab/ProteinGym_v1) · [Zenodo](https://doi.org/10.5281/zenodo.15293562) |
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

## 11. متن زیست‌پزشکی (NLP) و بنچمارک‌های کدنویسی

| # | دیتاست | ⭐ | ریپازیتوری | دانلود / روش دریافت |
|---|---|---|---|---|
| 1 | **IMCS-21**: بنچمارک مشاوره‌ی پزشکی خودکار | 73 | [lemuria-wchen/imcs21](https://github.com/lemuria-wchen/imcs21) | داخل ریپو |
| 2 | **BioCoder**: بنچمارک تولید کد بیوانفورماتیک | 59 | [gersteinlab/BioCoder](https://github.com/gersteinlab/BioCoder) | [Hugging Face](https://huggingface.co/datasets/lilbillbiscuit/biocoder_public) |
| 3 | **bioTaskBench**: بنچمارک وظایف بیوانفورماتیک | 16 | [GPTomics/bioTaskBench](https://github.com/GPTomics/bioTaskBench) | داخل ریپو |
| 4 | **PanCan-RE**: کورپوس روابط زیست‌پزشکی سرطان پانکراس | 0 | [MHD-AI-DS/PanCan-RE](https://github.com/MHD-AI-DS/PanCan-RE) | داخل ریپو |

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
