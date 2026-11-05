# Release Scriptoscope

## First npm launch

First-launch coordination is tracked in
[#649](https://github.com/khawkins98/scriptoscope/issues/649). The manual
`publish-npm.yml` workflow prepares/tests a candidate by default; only an explicit
`publish=true` dispatch publishes it.

Before merging the npm launch changes:

1. Use the public npm package `@khawkins98/scriptoscope`. Confirm access to the
   `khawkins98` npm account/scope and choose the first public version.
   Align `package.json`, `package-lock.json`, `VERSION` in `src/renderer.ts`, the
   dependency in `examples/npm/package.json` and the changelog. Use a fresh
   release version rather than presenting the historical GitHub release as a
   newly tested registry artifact.
2. Review `publish-npm.yml`: it validates the tag's main-branch ancestry and exact
   commit's successful dispatch/scheduled gate, packs once, tests that tarball,
   and records its integrity. Publication and registry smoke run in the pinned
   browser image. A retry accepts an existing version only when integrity matches.
3. Complete npm account/first-package bootstrap and configure
   [trusted publishing](https://docs.npmjs.com/trusted-publishers/): GitHub owner
   `khawkins98`, repository `scriptoscope`, workflow `publish-npm.yml`, environment
   `npm`. Allow direct publishing and dist-tag management. The workflow pins npm
   12.2.1, which supports both OIDC operations. If npm requires an initial
   authenticated publication before publisher setup, use the prepare-only
   artifact for that one-off bootstrap under `next`, then configure OIDC and
   resume the same tag's workflow. Do not publish a placeholder version or rebuild
   the bootstrap tarball; record any missing provenance on a manual first publish.
4. Review Pages coordination. `deploy-pages.yml` holds the build/deployment until
   npm `latest` matches the checkout's name/version and that version's tag has a
   completed successful `npm vX.Y.Z (latest)` publisher run. Prepare-only, next-only
   and failed promotion runs cannot unlock it. Missing releases leave the existing
   site untouched; registry outages fail the check. Publisher completion triggers
   Pages on main, where the check runs again. If main has advanced to another
   package version, Pages stays held until that version is released. This does not
   establish byte identity between the site's demo build and the npm library.
5. Require green PR CI and independent review. Account/bootstrap, publisher and
   Pages coordination are launch prerequisites, not effects of merging docs.

Then release in this order:

1. Merge the reviewed release changes with the Pages launch held as above.
2. Run the full release gate on the resulting commit and confirm the successful
   run tested that exact SHA, as described in the GitHub procedure below.
3. Tag the verified commit. Build/pack/test the candidate for that tag and publish
   the chosen version under `next` first, with public access (`publishConfig.access`
   is set to `public` for the scoped package). A stable version can
   use `next` as its initial dist-tag; that does not require a prerelease suffix.
4. Install `@khawkins98/scriptoscope@X.Y.Z` from the registry into a fresh app. Check registry
   integrity against the tested tarball, types/build, theme acquisition, browser
   rendering, native input interaction and teardown. Local tarball testing does
   not replace this registry check.
5. Promote that same version to `latest`, then verify plain
   `npm install @khawkins98/scriptoscope` and the documented example setup. Do not rebuild
   or republish to change a dist-tag.
6. Create the GitHub release with the gate, package version and provenance links,
   then release the prepared Pages/docs deployment and smoke-check the live guide.

After the workflow has landed on main and the release tag exists, first prepare
and test without publishing:

```sh
gh workflow run publish-npm.yml --ref vX.Y.Z -f tag=vX.Y.Z
```

Inspect the `npm-candidate-<run-id>` artifact (`release.json` plus the tarball)
and the package-consumer evidence. When ready to publish under `next`, dispatch
the same tag with `-f publish=true`. To publish/verify and promote to `latest`
in one run, also pass `-f promote_latest=true`. An existing identical version is
verified instead of published again, so promotion can be a later dispatch.
Use `--ref vX.Y.Z`: the workflow checks that its event SHA equals the release
commit, so provenance cannot point at a newer main commit. After successful
promotion, workflow completion automatically starts the Pages availability check.
Re-running all jobs replaces the same run's candidate/evidence artifacts after
the replacement candidate passes its checks; re-running only a failed publish
job reuses the existing tested candidate.

The registry smoke retries a newly published version's temporary 404 responses
for a bounded period. Registry outages and integrity mismatches fail immediately.
For a transient visibility/network failure, keep Pages held and rerun the same
tag; the workflow checks an existing version's integrity before proceeding. For
a broken package, fix and release a new version; never overwrite an existing
version. If a broken version reached `latest`, correct the dist-tag and deprecate
that version as needed.

See [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/) and
[dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages/) for registry
operations. OIDC publishing from a public GitHub repository generates provenance;
verify the attestation on the actual published package.

## GitHub release gate and tag procedure

1. Branch `release/X.Y.Z` from `main`. Commit `chore(release): prepare X.Y.Z`: bump `package.json`, `package-lock.json` and `VERSION` in `src/renderer.ts`; date the CHANGELOG section and end it with `npm run loc:src -- HEAD --base <previous tag>`; leave an empty Unreleased heading; update docs that describe the release as unreleased.
2. Open the release PR (`release: X.Y.Z`) against `main`. The PR tier and the release tier both run on it. Link the green **Release gate** run in the PR body. This is the early signal; it does not replace step 4.
3. Merge after independent review.
4. Identify the commit to tag (normally the merge commit on `main`). It needs its own green **Release gate** run: the PR run checked the merge preview, which is a different commit. Run `gh workflow run release-gate.yml --ref main`, then check that `gh run list --workflow release-gate.yml --branch main --event workflow_dispatch --json headSha,conclusion,url` shows `success` with `headSha` equal to that commit (only dispatch or scheduled runs count; the tag-push check enforces the same). Do not tag on red, and do not tag a commit whose run is still in progress. If `main` moves before the run finishes, start again on the new commit, or tag the commit that did pass.
5. Tag `vX.Y.Z` on that commit and push the tag. The tag push does not re-run the matrix. It checks that the tagged commit has a successful release-gate run and links it in the run summary. If it fails, the tag went on the wrong commit or was pushed too early: delete the tag before creating a release, then go back to step 4.
6. Create the GitHub release. Its notes link the green release-gate run from step 4 (as 0.7.0 linked its release CI) and include the size trend.
7. Smoke-check the deployed Pages site.
