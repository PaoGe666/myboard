#!/usr/bin/env ruby
require 'yaml'
require 'json'

config = ENV['MYBOARD_CONFIG'].to_s
if config.empty?
  running = `ps w 2>/dev/null`.lines.grep(/clash -d .* -f (\S+)/) { $1 }
  config = running.first.to_s.strip if running.first && File.exist?(running.first.to_s.strip)
end
if config.empty?
  config = Dir['/etc/openclash/*.yaml'].reject { |file| file.include?('template') }
    .max_by { |file| File.mtime(file) rescue 0 } || '/etc/openclash/config.yaml'
end

data = YAML.load_file(config, aliases: true)
abort 'configuration is not a Hash' unless data.is_a?(Hash)
nodes = data['proxies'].is_a?(Array) ? data['proxies'] : []
groups = data['proxy-groups'].is_a?(Array) ? data['proxy-groups'] : []
custom_names = nodes.filter_map { |node| node['name'] if node.is_a?(Hash) && !node['name'].to_s.empty? }
prefix = '__myboard_manual__::'
manual_groups = groups.select { |group| group.is_a?(Hash) && group['name'].to_s.start_with?(prefix) }
abort 'no manual strategy groups found' if manual_groups.empty?
manual_groups.each { |group| group['proxies'] = custom_names.dup }

backup = "#{config}.myboard-custom-manual.#{Time.now.strftime('%Y%m%d%H%M%S')}.bak"
File.write(backup, File.read(config))
File.write(config, YAML.dump(data))

api = ENV['MYBOARD_API'] || 'http://127.0.0.1:9090'
secret = ENV['MYBOARD_SECRET'].to_s
secret = data['secret'].to_s if secret.empty?
abort 'controller secret is missing' if secret.empty?
payload = JSON.generate(path: config)
cmd = "curl -s -k -m 30 -X PUT '#{api}/configs' -H 'Authorization: Bearer #{secret}' -H 'Content-Type: application/json' -d '#{payload}'"
response = `#{cmd} 2>&1`
if response.include?('"error"') || response.include?('"message"')
  File.write(config, File.read(backup))
  abort "reload failed; configuration restored: #{response[0, 200]}"
end
puts "synced=#{manual_groups.length} custom_nodes=#{custom_names.length} backup=#{backup}"
