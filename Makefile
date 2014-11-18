
%.js: %.ts ;	tsc -m commonjs -t es5 $<


all: index.js
