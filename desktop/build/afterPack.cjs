// Après l'assemblage Windows : icône et informations de version de l'exécutable, écrites en
// JavaScript (resedit) pour ne pas dépendre de wine quand on construit depuis Linux.
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const info = ctx.packager.appInfo;
  const exe = path.join(ctx.appOutDir, `${info.productFilename}.exe`);
  const alt = path.join(ctx.appOutDir, `${ctx.packager.executableName || info.productFilename}.exe`);
  const file = fs.existsSync(exe) ? exe : alt;
  const ex = ResEdit.NtExecutable.from(fs.readFileSync(file), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(ex);

  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const groupId = groups.length ? groups[0].id : 1;
  const lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, lang, ico.icons.map(i => i.data));

  const [major, minor, patch] = info.version.split('.').map(n => parseInt(n, 10) || 0);
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
  vi.setFileVersion(major, minor, patch, 0, 1033);
  vi.setProductVersion(major, minor, patch, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: info.productName,
    ProductName: info.productName,
    CompanyName: info.companyName || 'Stella Caltagirone',
    LegalCopyright: info.copyright || '',
    OriginalFilename: path.basename(file),
    InternalName: info.productFilename,
    FileVersion: info.version,
    ProductVersion: info.version,
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(ex);
  fs.writeFileSync(file, Buffer.from(ex.generate()));
  console.log(`  • icône et version écrites dans ${path.basename(file)}`);
};
