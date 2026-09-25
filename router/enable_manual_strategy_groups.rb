#!/usr/bin/env ruby
# Create a hidden, independent node selector behind each policy group.
require 'yaml'
require 'json'

config_path = ARGV[0] || '/etc/openclash/20260908.yaml'
source_path = ARGV[1] || config_path
data = YAML.load_file(source_path, aliases: true)
groups = data['proxy-groups']
providers = data['proxy-providers'] || {}
abort 'proxy-groups is missing' unless groups.is_a?(Array)

backup = "#{config_path}.myboard-manual.#{Time.now.strftime('%Y%m%d%H%M%S')}.bak"
File.write(backup, File.read(config_path))

prefix = '__myboard_manual__::'
# Start clean when migrating from the earlier include-all-providers implementation.
groups.each do |group|
  next unless group.is_a?(Hash)

  group.delete('include-all-providers')
  group['proxies'].delete('手动') if group['name'] == '全球加速' && group['proxies'].is_a?(Array)
end
groups.delete_if do |group|
  group.is_a?(Hash) &&
    ((group['name'] == '手动' && group['type'].to_s.downcase == 'select' && group['use'].is_a?(Array)) ||
      group['name'].to_s.start_with?(prefix))
end
groups.each do |group|
  group['proxies'].delete_if { |name| name.to_s.start_with?(prefix) } if group.is_a?(Hash) && group['proxies'].is_a?(Array)
end

groups.select { |group| group.is_a?(Hash) && group['type'].to_s.downcase == 'select' }.each do |group|
  next if group['name'].to_s.start_with?(prefix)

  manual_name = "#{prefix}#{group['name']}"
  groups << {
    'name' => manual_name,
    'type' => 'select',
    'hidden' => true,
    'use' => providers.keys,
    'proxies' => Array(data['proxies']).filter_map { |proxy| proxy['name'] if proxy.is_a?(Hash) && proxy['name'] },
  }
  group['proxies'] ||= []
  group['proxies'] << manual_name unless group['proxies'].include?(manual_name)
end

File.write(config_path, YAML.dump(data))
puts "manual_groups=#{groups.count { |g| g.is_a?(Hash) && g['name'].to_s.start_with?(prefix) }} backup=#{backup}"

if data['external-controller'] && data['external-controller'].to_s.match?(/127\.0\.0\.1|0\.0\.0\.0|localhost/)
  endpoint = "http://127.0.0.1:#{data['external-controller'].to_s.split(':').last}/configs?force=true"
  argv = ['curl', '-sS', '-o', '/tmp/myboard-manual-reload.json', '-w', '%{http_code}',
          '-X', 'PUT', '-H', 'Content-Type: application/json']
  argv += ['-H', "Authorization: Bearer #{data['secret']}"] if data['secret'] && !data['secret'].empty?
  argv += ['-d', JSON.generate(path: config_path), endpoint]
  puts "core_reload_http=#{IO.popen(argv, 'r', &:read)}"
else
  puts 'core_reload_skipped: no local external-controller found'
end
