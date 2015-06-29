#!/bin/bash 

#
# This script builds Rev RUM service Debian package
#

if [ -z "$WORKSPACE" ]; then
	echo "ERROR: WORKSPACE env. variable is not set"
	exit 1
fi

if [ -z "$BUILD_NUMBER" ]; then
	echo "ERROR: BUILD_NUMBER env. variable is not set"
	exit 1
fi

VERSION=3.0.$BUILD_NUMBER

CODEDIR=revsw-rum

if [ ! -d $CODEDIR ]; then
	echo "ERROR: Cannot find directory $CODEDIR"
	echo "ERROR: Please run the script from the top of Portal repo clone directory"
	exit 1
fi


PACKAGEDIR=packages

if [ ! -d $PACKAGEDIR ]; then
        echo "INFO: Directory $PACKAGEDIR does not exist - creating it..."
        mkdir $PACKAGEDIR
        if [ $? -ne 0 ]; then
                echo "ERROR: Failed to create directory $PACKAGEDIR - aborting"
                exit 1
        fi
fi


dat=`date +%Y_%m_%d_%H_%M_%S`

WORKDIR=revsw-rum'_'$VERSION'_'$dat 
mkdir $WORKDIR
cd $WORKDIR


foldername=revsw-rum'_'$VERSION
mkdir -p $foldername/DEBIAN
touch $foldername/DEBIAN/control

PackageName=revsw-rum
PackageVersion=$VERSION
MaintainerName="Victor Gartvich"
MaintainerEmail=victor@revsw.com

echo "Package: $PackageName
Version: $PackageVersion
Architecture: amd64
Maintainer: $MaintainerName <$MaintainerEmail>
Installed-Size: 26
Section: unknown
Priority: extra
Homepage: www.revsw.com
Description: Rev RUM Service" >> $foldername/DEBIAN/control

mkdir -p $foldername/etc/init.d  $foldername/etc/logrotate.d

cp -rp $WORKSPACE/scripts/revsw-rum  $foldername/etc/init.d/revsw-rum

cp -rp $WORKSPACE/revsw-rum/config/logrotate_revsw-rum $foldername/etc/logrotate.d/revsw-rum


mkdir -p $foldername/opt/$PackageName/config

cp -rf  $WORKSPACE/revsw-rum/node_modules  $foldername/opt/$PackageName/
cp -rf  $WORKSPACE/revsw-rum/collector_bridge.js  $foldername/opt/$PackageName/
cp -rf  $WORKSPACE/revsw-rum/server.js  $foldername/opt/$PackageName/
cp -rf  $WORKSPACE/revsw-rum/package.json  $foldername/opt/$PackageName/
cp -rp $WORKSPACE/revsw-rum/config/config.js.def $foldername/opt/$PackageName/config/

mkdir -p $foldername/opt/$PackageName/log

sudo chown -R root:root $foldername/opt
sudo chown -R root:root $foldername/etc

dpkg -b $foldername $WORKSPACE/$PACKAGEDIR/$foldername.deb

