#!/usr/bin/perl -w

# based on version from 4store

$version=`git describe --tags --always | sed 's/^v//; s/-.*//'`;
chomp $version;

$du = `du -csk dist/INDX.app`;
($size) = ($du =~ /\s*(\d+)\s+total\s*$/si);
$size = int $size * 1.5 / 1024 + 1;

print("building $size MB DMG\n");

$output = `hdiutil create "INDX-$version" -ov -megabytes $size -fs HFS+ -volname \"INDX-$version\"`;
die "Couldn't create INDX.dmg\nIs it mounted?" if $?;
($dmgName) = ($output =~ /created\s*:\s*(.+?)\s*$/m);
die "FATAL: Couldn't read created dmg name\n" unless $dmgName;
print("INFO: dmgName is $dmgName\n");
$output = `hdiutil attach \"$dmgName\"`;
die "FATAL: Couldn't mount DMG $dmgName (Error: $?)\n" if $?;

my ($dest) = ($output =~ /Apple_HFS\s+(.+?)\s*$/im);

$output = `cp -r dist/INDX.app "$dest"`;
#$readme = `cat app-aux/README.rtf`;
#$readme =~ s/\$\\{AV\\}/$version/g;
#open(README, '>', "$dest/README.rtf");
#print(README $readme);
#close(README);
system("ln -s /Applications \"$dest/Applications\"");

$output = `hdiutil detach "$dest"`;
die "FATAL: Error while copying files (Error: $err)\n" if $err;
die "FATAL: Couldn't unmount device \"$dest\": $?\n" if $?;

$tmpName = $dmgName."~";
rename($dmgName, $tmpName);
$output = `hdiutil convert "$tmpName" -format UDZO -imagekey zlib-level=8 -o "$dmgName"`;
die "Error: Couldn't compress the dmg $dmgName: $?\n" if $?;
unlink($tmpName);

print("\nDONE: Final DMG in $dmgName\n");
