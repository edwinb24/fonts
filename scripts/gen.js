const yaml  = require('js-yaml')
const fs    = require('fs')
const npath = require('path')

const types = {
  'bold-italic': ['bold', 'italic'],
  'bold': ['bold', 'normal'],
  'italic': ['normal', 'italic'],
  'normal': ['normal', 'normal'],
}
const rootPath = 'atom://fonts/resources'

function fontFace(font, type, path) {
  if (!types[type]) throw new Error(`Unknown type for ${font}: ${type}`)
  const [weight, style] = types[type]
  return `.font ( '${font}', ${weight}, ${style}, '${path}' );`;
}

const fontLessTemplate = `\
.font(@font, @weight, @style, @path) {
  @font-face {
    font-family: @font;
    font-weight: @weight;
    font-style: @style;
    src: url('${rootPath}/@{path}');
  }
}
`

try {
  const doc = yaml.safeLoad(fs.readFileSync(npath.join('scripts', 'fonts.yaml'), 'utf8'));
  const resourceDir = npath.join(__dirname, '..', 'resources')

  // write styles/fonts.less
  const fontsless = [fontLessTemplate]

  function addFont(font, type, path) {
    if (!fs.existsSync(npath.join(resourceDir, ...path.split('/')))) {
      throw new Error(`File ${path} does not exist for ${type} variant of font ${font}`)
    }
    fontsless.push(fontFace(font, type, path))
  }

  function cmp(a,b) {
    return a[0].localeCompare(b[0], 'en', {
      sensitivity: 'base',
      ignorePunctuation: true,
    })
  }

  for (const [font, conf] of Object.entries(doc).sort(cmp)) {
    if (typeof conf === 'string') {
      addFont(font, 'normal', conf)
    } else {
      if (Object.keys(conf).length === 1 && Object.keys(conf)[0] === 'normal') {
        console.warn(`Found long form normal-only font definition: ${font}`)
      }
      if (!Object.keys(conf).includes('normal')) {
        throw new Error(`No normal variant for: ${font}`)
      }
      for (const [type, path] of Object.entries(conf).sort(cmp)) {
        addFont(font, type, path)
      }
    }
  }
  fs.writeFileSync(npath.join('styles', 'fonts.less'), fontsless.join('\n')+'\n', 'utf8')

  // write package.json
  const allfonts = Object.keys(doc).sort()
  const packagejson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  packagejson.configSchema.fontFamily.enum = allfonts
  fs.writeFileSync('package.json', JSON.stringify(packagejson, null, 2)+'\n', 'utf8')

  // write README.md
  const readme = fs.readFileSync('README.md', 'utf8')
  const newreadme = readme.replace(
    /<!-- BEGIN FONTS -->[^]*<!-- END FONTS -->/,
    `<!-- BEGIN FONTS -->\n${allfonts.join(', ')}\n<!-- END FONTS -->`
  )
  fs.writeFileSync('README.md', newreadme, 'utf8')
} catch (e) {
  console.log(e);
}
