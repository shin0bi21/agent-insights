# Review and shipping

Implementation, review, feature shipping, release, and deployment are separate phases. Completing or reviewing code does not authorize commits, remote changes, releases, or deployment.

## Review

Use `split-changes` before reviewing a large or mixed working tree. Its concern map is the source of truth for review and shipping. Review one concern for correctness, provider neutrality, path and subprocess safety, evaluator validity, accessibility, evidence integrity, tests, and documentation alignment. A clean review does not authorize shipping.

Reuse focused verification when it covers the exact unchanged concern diff. GitHub required checks are the full merge gate; do not repeatedly run equivalent full suites locally.

## Feature shipping

After explicit approval, use `ship-changes` to:

1. create or reuse a GitHub issue with acceptance criteria;
2. synchronize `develop` and create `<issue-number>-<short-description>`;
3. isolate only that concern and preserve unrelated work;
4. run focused checks and inspect the final diff;
5. commit with an issue reference and open a pull request to `develop` containing `Closes #<number>`;
6. wait for all required checks, merge, delete the feature branch, and return to clean synchronized `develop`.

Ship multiple concerns serially. Do not prepare the next concern branch before the current pull request is merged and `develop` is synchronized.

## Release boundary

A request to commit, push, ship, or merge authorizes work only through `develop`. Moving `develop` into `main` requires a separately authorized release pull request. Deployment, package publication, and uploading local benchmark data are never implied.
