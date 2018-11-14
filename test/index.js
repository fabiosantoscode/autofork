const assert = require('assert')
const {execSync} = require('child_process')
const autofork = require('..')

const diff = `
diff --git a/README.md b/README.md
index 77bab7c..276faa0 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
-# autofork-test
\\ No newline at end of file
+# autofork-test
+hello world
`

describe('autofork', function() {
  this.timeout(30 * 1000)
  afterEach(() => {
    execSync('rm -rf test/repo*')
  })
  it('can autofork and maintain a git branch', async () => {
    console.log(execSync('git clone git@github.com:fabiosantoscode/autofork-test.git test/repo').toString().trim())

    await autofork(
      'test/repo',
      'test/repofork',
      {diff}
    )

    execSync('touch test/repo/foo && cd test/repo && git add . && git commit -am.')

    execSync('cd test/repofork && git checkout . && git clean -f')

    await autofork.maintain(
      'test/repo',
      'test/repofork',
      {diff}
    )
  })
  it('fetches a remote clone', async () => {
    await autofork(
      'git@github.com:fabiosantoscode/autofork-test.git',
      'test/repofork',
      {diff}
    )

    assert.equal(execSync('cat test/repofork/README.md') + '',
    '# autofork-test\nhello world\n')
  })
})
