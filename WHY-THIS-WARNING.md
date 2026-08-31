# Why am I seeing this warning?

A plugin you installed needs another plugin, **hfs-shared**, to work. The
warning box means HFS can't find a working copy of it right now.

## What to do

1. Open the **Plugins** search tab in the HFS admin panel.
2. Search for `hfs-shared`.
3. Install it, or update it if it's already installed but out of date.

That's it. You don't need to restart HFS or the plugin that showed the
warning -- it clears by itself within a few seconds of hfs-shared starting
up.

## Why does this happen at all?

Normally a plugin that needs another one just fails to load silently if
that other plugin is missing, and you'd have no idea why. This warning
exists so you get a clear, specific message instead: which plugin is
missing, and where to get it.

## Still stuck?

Make sure the version of hfs-shared you installed is new enough for the
plugin that's asking for it (its warning text says which version range it
needs). If updating doesn't clear the warning after a minute or two, try
disabling and re-enabling the plugin that showed it.
