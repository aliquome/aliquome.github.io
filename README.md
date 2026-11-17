# Bioinformatics Data Atlas

Find the exact release of the data your analysis needs.

The atlas is a static website, rebuilt every day, that brings together:

- **Databases.** Every release of 83 core bioinformatics databases (Ensembl, GENCODE, UniProt, PDB, AlphaFold DB, gnomAD, ClinVar, GDC, ChEMBL, STRING and more): 794 releases, 732 with a direct link you can paste into code, with ready-made `curl`, `wget`, Python, `pooch`, R, AWS CLI and `gcloud` snippets.
- **Datasets.** 520 public datasets and benchmarks with repository, paper and download links: 194 collected from repositories, papers and challenges, and 326 bioinformatics datasets selected from the final Papers with Code archive.
- **New papers.** Every paper from the last 60 days in the leading bioinformatics and computational biology journals (about 1,400), sorted into fields and tasks, with filters by journal, task and period.
- **Top papers.** The most cited open-access papers in 11 fields, of all time and of the last 24 months, with abstracts, tagged by task and by the datasets they name. Filter them and compare methods side by side.
- **Benchmarks.** 202 results tables for bioinformatics tasks (1,858 published results: molecular property prediction, protein function and structure, biomedical text mining, histopathology, cell segmentation and more), plus the ProteinGym boards copied daily. Any table can be re-ranked by another metric, and anyone can propose a new ranking, which goes live after a maintainer approves it.
- **Status.** A daily check of every source's website and of the download link of its current release.

Every database and dataset has its own 3D figure and chromatogram trace, both generated from its name.

## Repository layout

| Path | Contents |
|---|---|
| `data/` | All inputs. `sources.toml` (databases), `database_versions.csv` (releases and links), `datasets.csv`, `fields.toml` (fields, tasks, paper queries), `latest.toml` (journals for new papers), `leaderboards.toml` (benchmark tables), `loaders.toml` (library calls and official client commands that fetch a dataset or database) |
| `engine/` | `atlas`, a Rust program that turns `data/` into the JSON files under `site/data/`, fetches papers and benchmark tables, and checks sources |
| `site/` | The website: HTML, CSS and JavaScript, with three.js for the 3D figures |
| `.github/workflows/daily.yml` | Daily build: compile, reproducibility check, data refresh, commit, deploy to GitHub Pages |
| `docs/` | Design notes and research (Persian): roadmap, platform guide, tool design, database and tool surveys |

## Run it

```bash
# build the data (needs Rust)
cargo run --release --manifest-path engine/Cargo.toml -- build
# rebuild without any network call; same inputs give the same output
cargo run --release --manifest-path engine/Cargo.toml -- build --offline
# serve the site
npx serve site
```

Opening `site/index.html` straight from disk does not work, because the page loads its data with `fetch`.

## Publish on GitHub Pages

1. Push this folder to a public repository, on the `main` branch.
2. **Settings → Pages → Source:** GitHub Actions.
3. **Settings → Actions → General → Workflow permissions:** Read and write.
4. Run **Daily build and deploy** once from the Actions tab.

## Reproducibility

- Databases, releases and datasets come only from files in `data/`. The daily job builds them twice offline and stops if the outputs differ.
- `site/data/build.json` records the commit, engine version and SHA-256 of every input.
- Papers, benchmark tables and status depend on the day; each version is kept in the git history.
- For your own work, copy the release link from a database page and record its checksum. The `pooch` snippet on each page does both.

## Contributing

To add a database, add a `[[source]]` block to `data/sources.toml` and its releases to `data/database_versions.csv`. To add a benchmark table, add a `[[board]]` block to `data/leaderboards.toml`. No code change is needed.

## Licence

Code: `MIT OR Apache-2.0` (see `LICENSE-MIT` and `LICENSE-APACHE`). The atlas links to data and hosts none of it; each source keeps its own licence, shown on its page.

## Changing a ranking

Rankings of the results tables follow `data/rankings.toml`, and only the repository owner can change it:

1. On a table page, a reader picks another metric, flips the order or leaves out rows, then presses **Propose this ranking**. This opens a GitHub issue from the *Ranking change* form with the proposal as a TOML block.
2. The owner reviews the issue and adds the `approved` label. The workflow `.github/workflows/rankings.yml` runs only when the person adding the label is the repository owner.
3. `scripts/apply-ranking.mjs` checks the proposal against the table (known metric and models, https sources, allowed keys only), writes it to `data/rankings.toml`, starts the site build and closes the issue. A proposal that fails a check gets a comment and loses the label.

Create the labels `ranking` and `approved` once in the repository. On a custom domain, set the repository in `<meta name="atlas-repo">` in `site/index.html`.

## Credits

326 dataset entries (ids starting with `pwc-` in `data/datasets.csv`) are selected from the final Papers with Code archive, [pwc-archive/datasets](https://huggingface.co/datasets/pwc-archive/datasets) on Hugging Face (snapshot of 28 July 2025, licensed CC BY-SA 4.0). Of its 15,008 datasets, those about sequences, structures, molecules, cells, tissue images and biomedical text were kept. Medical imaging, clinical records and general machine-learning sets were left out. Names, descriptions, links and paper counts are taken from the archive; descriptions are shortened.

The 202 results tables in `data/benchmarks/` are selected from the Papers with Code archive, [pwc-archive/evaluation-tables](https://huggingface.co/datasets/pwc-archive/evaluation-tables) (snapshot of 28 July 2025, CC BY-SA 4.0): of its 21,225 tables, those on bioinformatics datasets and tasks. Scores are copied as published.
