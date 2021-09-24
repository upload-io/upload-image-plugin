# Releasing

To release a new version:

1.  `npm run test`

2.  `gco main`

3.  Set `x.y.z` into `package.json`

4.  Set `x.y.z` into `README.md`

5.  Set `x.y.z` into `upload-plugin.json` (find/replace old version)

6.  Set `x.y.z` into `OfficialPlugins.ts` (in `upload` repository)

7.  `gcmsg 'Release x.y.z'`

8.  `gp`

The CI process will automatically `git tag` and `npm publish`.

(It does this by pattern-matching on `^Release (\S+)` commit messages on the `main` branch.)
