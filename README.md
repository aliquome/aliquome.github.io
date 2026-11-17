<h1 align="center">Aliquome</h1>

<p align="center"><b>An exact aliquot of every bioinformatics database: the precise release, one link away.</b><br>
Versioned download links, ready-to-run download code, AI-ready datasets, model leaderboards and the newest papers, in one open atlas.</p>

<p align="center">
<img alt="Databases" src="https://img.shields.io/badge/databases-83-2e7d6b">
<img alt="Releases" src="https://img.shields.io/badge/releases-794-2e7d6b">
<img alt="Datasets" src="https://img.shields.io/badge/datasets-519-3b6fb6">
<img alt="Benchmark tables" src="https://img.shields.io/badge/benchmark%20tables-200-b07d2b">
<img alt="Updated" src="https://img.shields.io/badge/updated-every%202%20days-6b6b6b">
<img alt="License" src="https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue">
</p>

<p align="center">
<a href="#why-aliquome"><b>Why Aliquome</b></a> |
<a href="#whats-inside"><b>What's inside</b></a> |
<a href="#use-it-in-your-code"><b>Use it in code</b></a> |
<a href="#run-it-locally"><b>Run locally</b></a> |
<a href="#contribute"><b>Contribute</b></a> |
<a href="#cite"><b>Cite</b></a>
</p>

---

**Aliquome** (*aliquot* + *-ome*: an exact portion of every dataset) is an open, free catalogue of **bioinformatics databases and datasets with every release version and a direct download link**. Reproducible research needs the exact data: *GRCh38 or T2T-CHM13? Ensembl 113 or 116? gnomAD v3 or v4? UniProt 2026_04?* Aliquome answers that for 83 core resources (reference genomes, variants, cancer genomics, single-cell and expression, protein structures, pathways, drug discovery, epigenomics, RNA and microbiome), and turns each link into ready-to-run download code for **curl, wget, Python, R, `pooch`, AWS CLI and `gcloud`**.

It also gathers **519 machine-learning-ready biology datasets**, **200 benchmark tables with 1,854 published results** to compare models, and the **newest papers from 22 leading bioinformatics and computational biology journals**. A Rust engine rebuilds everything every two days and checks that every source is still online. The site is static, fast and hosted on GitHub Pages.

## Why Aliquome

- **Every version, one link away.** 794 releases of 83 databases, 733 of them with a direct, versioned URL you can paste into a pipeline, so your analysis can be rerun years later.
- **Download code for every link.** Files, FTP folders, Zenodo, Figshare, Hugging Face, Kaggle, GEO, Synapse, Dryad, Mendeley Data and GitHub each get the right client command. 75 library loaders (PyTorch Geometric, DeepChem, TDC, OGB, Hugging Face `datasets`, Bioconductor) and official clients for controlled data (UK Biobank, COSMIC, GDC, DepMap).
- **Datasets for AI in biology.** 519 datasets for protein, molecule, single-cell, genomics, histopathology, microscopy and biomedical text tasks; 89% come with download code.
- **Benchmarks you can rank yourself.** 200 results tables (molecular property prediction, protein function, drug–target interaction, retrosynthesis, biomedical NER, nucleus segmentation and more) plus the ProteinGym leaderboards. Re-rank by any metric, open a model or paper to see every ranking it appears in.
- **Community updates, reviewed.** Readers sign in with a one-time email code and suggest a ranking, add a result from their own paper or correct a value; nothing changes until a maintainer approves it.
- **New papers, sorted.** The last 60 days of Bioinformatics, Nucleic Acids Research, Genome Biology, Nature Methods, Nature Biotechnology and more, tagged by field and task, with open abstracts.
- **Reproducible by design.** All catalogue data lives in plain files in `data/`; offline builds are byte-identical, and every build records the SHA-256 of its inputs.
- **Free and open.** No account, no tracking, no server. Code under `MIT OR Apache-2.0`.

## What's inside

| Section | What you get | Size |
|---|---|---|
| **Databases** | Every release with date, status, direct link and download code | 83 databases, 794 releases |
| **Datasets** | Description, licence, paper, repository, loaders and download code | 519 datasets |
| **Benchmarks** | Results tables to filter by task and dataset; model and paper profiles | 200 tables, 951 models, 4 ProteinGym boards |
| **Papers** | New papers from leading journals, and the most cited open-access papers per field | ~1,350 new, 651 top papers |
| **Status** | Reachability of every source and of its current download link | checked every two days |

**Fields:** genomes and annotation · variants and population genetics · cancer genomics · expression and single-cell · proteins and structures · pathways, networks and ontologies · chemistry and drug discovery · epigenomics and regulation · RNA · microbiome and metagenomics · benchmarks and machine learning.

**Some of the databases:** GRCh37, GRCh38, T2T-CHM13, Ensembl, GENCODE, RefSeq, MANE, dbSNP, ClinVar, gnomAD, 1000 Genomes, UK Biobank, GDC/TCGA, COSMIC, DepMap, GTEx, CELLxGENE Census, Human Protein Atlas, UniProt, PDB, AlphaFold DB, Pfam, InterPro, CATH, KEGG, Reactome, Gene Ontology, ChEMBL, PubChem, DrugBank, ENCODE, JASPAR, RNAcentral, Rfam, GTDB and more.

## Use it in your code

Each database page gives a versioned link and code. For example, to fetch one release and record its checksum:

```python
import pooch  # downloads once, caches, and records the SHA-256

path = pooch.retrieve(
    url="https://ftp.ebi.ac.uk/pub/databases/uniprot/current_release/knowledgebase/complete/uniprot_sprot.fasta.gz",
    known_hash=None,
)
print(pooch.file_hash(path))  # keep this next to your results
```

Datasets show the library call that loads them:

```python
from tdc.multi_pred import DTI   # pip install PyTDC
data = DTI(name="DAVIS")
split = data.get_split()
```

The whole catalogue is also plain JSON, so scripts can query it directly:

| File | Contents |
|---|---|
| `site/data/sources.json` | databases, every release, links and loaders |
| `site/data/datasets.json` | datasets, links, licences and loaders |
| `site/data/benchmarks/*.json` | results tables |
| `site/data/latest.json`, `papers.json` | new and most cited papers |

On the published site these are served at `https://<user>.github.io/aliquome/data/<file>`.

## Run it locally

```bash
# build the data (needs Rust); --offline makes no network call
cargo run --release --manifest-path engine/Cargo.toml -- build --offline
# serve the site, then open http://localhost:3000
npx serve site
```

The page loads its data with `fetch`, so open it through a local server, not from disk.

## How it works

```
data/            plain-text catalogue: databases, releases, datasets, fields, journals, loaders, rankings
engine/          Rust program `aliquome`: turns data/ into site/data/*.json, fetches papers and
                 benchmark tables, checks every source (layers: domain, steps, infra)
site/            static website: HTML, CSS and ES modules (domain, core, ui, pages), three.js figures
.github/         build and deploy every two days; ranking approvals; reader suggestions; tests
supabase/        database rules for email sign-in and reader suggestions
tests/           end-to-end test of sign-in, suggestions, review and table updates
```

### Publish your own copy

1. Push to a public repository named `aliquome`, on `main`.
2. **Settings → Pages → Source:** GitHub Actions. **Settings → Actions → Workflow permissions:** read and write.
3. Run **Build and deploy** once from the Actions tab. It then runs every two days.
4. Optional: email sign-in for reader suggestions, see [docs/SUBMISSIONS.md](docs/SUBMISSIONS.md) (about 15 minutes).

## Contribute

- **Add a database:** a `[[source]]` block in `data/sources.toml` and its releases in `data/database_versions.csv`.
- **Add a dataset:** a row in `data/datasets.csv`; a library call in `data/loaders.toml`.
- **Add a benchmark board:** a `[[board]]` block in `data/leaderboards.toml`.
- **Change a ranking or add your paper's results:** use *Suggest a change* on any benchmark table.

No code change is needed for any of these. Open a pull request or an issue.

## Cite

If Aliquome helps your research, please cite it:

```bibtex
@misc{aliquome2026,
  title  = {Aliquome: versioned bioinformatics databases, datasets and benchmarks},
  year   = {2026},
  note   = {Open catalogue with direct release links and download code},
  howpublished = {\url{https://github.com/<user>/aliquome}}
}
```

## Credits and licence

Code: `MIT OR Apache-2.0` ([LICENSE-MIT](LICENSE-MIT), [LICENSE-APACHE](LICENSE-APACHE)). Aliquome links to data and hosts none of it; each source keeps its own licence, shown on its page.

326 dataset entries (ids starting with `pwc-`) and the 200 results tables are selected from the final Papers with Code archive on Hugging Face, [pwc-archive/datasets](https://huggingface.co/datasets/pwc-archive/datasets) and [pwc-archive/evaluation-tables](https://huggingface.co/datasets/pwc-archive/evaluation-tables) (snapshot of 28 July 2025, CC BY-SA 4.0). Papers come from [Europe PMC](https://europepmc.org); leaderboards from [ProteinGym](https://proteingym.org).

<sub>Keywords: bioinformatics database versions, reproducible bioinformatics, genome reference download, GRCh38, T2T-CHM13, Ensembl release, UniProt release, AlphaFold DB, gnomAD, ClinVar, ChEMBL, single-cell datasets, protein datasets, drug discovery datasets, machine learning benchmarks for biology, leaderboards, computational biology papers.</sub>
