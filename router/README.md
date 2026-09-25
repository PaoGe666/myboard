# Myboard local subscription endpoint

The VLESS Base64 flow parses each share link into a Mihomo proxy object, then posts the named node list to `myboard_local_provider`. The CGI creates one `type: file` proxy-provider and writes its `proxies:` YAML under `/etc/openclash/proxy_provider/myboard/`.

Install on an OpenClash router that already has `/usr/share/openclash/myboard_provider.rb`:

```sh
ruby patch_myboard_provider.rb /usr/share/openclash/myboard_provider.rb
ruby -c /usr/share/openclash/myboard_provider.rb
cp myboard_local_provider /www/cgi-bin/myboard_local_provider
chmod 755 /www/cgi-bin/myboard_local_provider
cp myboard_node /www/cgi-bin/myboard_node
chmod 755 /www/cgi-bin/myboard_node
cp myboard_node.rb /usr/share/openclash/myboard_node.rb
chmod 755 /usr/share/openclash/myboard_node.rb
```

The patcher keeps a `.before-local-provider` backup and can be run again safely. Removing a local provider removes its YAML file only after the config reload succeeds.

Each selector policy group has a hidden `__myboard_manual__::...` child selector backed by the configured proxy providers. Myboard hides that implementation group from the main list and exposes its enabled nodes through the per-group `手动` button. Subscription add/delete operations update each child selector's provider list.
