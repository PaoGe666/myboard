#!/usr/bin/env ruby
# Extend the installed OpenClash Myboard provider helper with static providers.
require 'yaml'
require 'json'

target = ARGV[0] || '/usr/share/openclash/myboard_provider.rb'
source = File.read(target)
source.gsub!('YAML.load_file(CONFIG)', 'YAML.load_file(CONFIG, aliases: true)')
source.sub!(
  "data = YAML.load_file(CONFIG, aliases: true)\ndie('配置不是 Hash') unless data.is_a?(Hash)",
  "data = YAML.load_file(CONFIG, aliases: true)\ndie('配置不是 Hash') unless data.is_a?(Hash)\nsecret = ENV['MYBOARD_SECRET'].to_s\nsecret = data['secret'].to_s if secret.empty?\ndie('未配置控制器密钥') if secret.empty?",
)
source.gsub!('#{SECRET}', '#{secret}')
source.sub!(
  "if reload.include?('\"error\"')",
  "if reload.include?('\"error\"') || reload.include?('\"message\"')",
)
provider_group_sync = <<~'RUBY'
  # Keep one hidden node selector per policy group, so each group can choose independently.
  groups = data['proxy-groups'] ||= []
  provider_names = providers.keys
  custom_proxy_names = Array(data['proxies']).filter_map do |proxy|
    proxy['name'] if proxy.is_a?(Hash) && !proxy['name'].to_s.empty?
  end
  groups.each do |group|
    next unless group.is_a?(Hash) && group['use'].is_a?(Array)

    group['use'].select! { |provider_name| provider_names.include?(provider_name) }
  end
  manual_prefix = '__myboard_manual__::'
  if provider_names.any? || custom_proxy_names.any?
    groups.select { |group| group.is_a?(Hash) && group['type'].to_s.downcase == 'select' }.each do |group|
      next if group['name'].to_s.start_with?(manual_prefix)

      manual_name = "#{manual_prefix}#{group['name']}"
      manual_group = groups.find { |item| item.is_a?(Hash) && item['name'] == manual_name }
      unless manual_group
        manual_group = { 'name' => manual_name, 'type' => 'select', 'hidden' => true }
        groups << manual_group
      end
      manual_group['type'] = 'select'
      manual_group['hidden'] = true
      manual_group['use'] = provider_names
      manual_group['proxies'] = custom_proxy_names
      group['proxies'] ||= []
      group['proxies'] << manual_name unless group['proxies'].include?(manual_name)
    end
  else
    groups.delete_if { |group| group.is_a?(Hash) && group['name'].to_s.start_with?(manual_prefix) }
    groups.each do |group|
      group['proxies'].delete_if { |name| name.to_s.start_with?(manual_prefix) } if group.is_a?(Hash) && group['proxies'].is_a?(Array)
    end
  end
  obsolete_manual = groups.find do |group|
    group.is_a?(Hash) && group['name'] == '手动' && group['type'].to_s.downcase == 'select' && group['use'].is_a?(Array)
  end
  groups.delete(obsolete_manual) if obsolete_manual
  global_group = groups.find { |group| group.is_a?(Hash) && group['name'] == '全球加速' }
  global_group['proxies'].delete('手动') if global_group && global_group['proxies'].is_a?(Array)
RUBY

if source.include?("local_path_to_delete = nil") && source.include?("add-local") && source.include?('/etc/openclash/proxy_provider/myboard/')
  old_local_provider = "providers[name] = { 'type' => 'file', 'path' => provider_path }"
  new_local_provider = <<~'RUBY'.strip
    providers[name] = {
      'type' => 'file',
      'path' => provider_path,
      'health-check' => { 'enable' => true, 'interval' => 3600, 'url' => 'http://www.gstatic.com/generate_204' },
    }
  RUBY
  changed = false
  manual_sync_pattern = /^# Keep one hidden node selector per policy group.*?(?=^# 备份)/m
  if source.match?(manual_sync_pattern)
    source.sub!(manual_sync_pattern, "#{provider_group_sync}\n")
    File.write("#{target}.manual-group.bak", File.read(target)) unless File.exist?("#{target}.manual-group.bak")
    changed = true
  end
  if File.read(target).include?('YAML.load_file(CONFIG)')
    File.write("#{target}.yaml-aliases.bak", File.read(target)) unless File.exist?("#{target}.yaml-aliases.bak")
    changed = true
  end
  if source.include?(old_local_provider)
    source.sub!(old_local_provider, new_local_provider)
    File.write("#{target}.health-check.bak", File.read(target)) unless File.exist?("#{target}.health-check.bak")
    changed = true
  end
  if source.include?('Allow every selector policy group to choose nodes from enabled providers independently')
    source.sub!(/^# Allow every selector policy group to choose nodes from enabled providers independently.*?(?=^# 备份)/m, '')
    changed = true
  end
  unless source.include?('Keep one hidden node selector per policy group')
    source.sub!("# 备份", "#{provider_group_sync}\n# 备份") || abort('missing config backup marker')
    File.write("#{target}.manual-group.bak", File.read(target)) unless File.exist?("#{target}.manual-group.bak")
    changed = true
  end
  File.write(target, source) if changed
  puts(changed ? 'updated local provider support' : 'already patched')
  exit 0
end

source.sub!("require 'yaml'", "require 'yaml'\nrequire 'json'") || abort('missing yaml require')
source.sub!(
  "die('usage: add|delete name [url]') unless %w[add delete].include?(action)",
  "die('usage: add|delete|add-local name [url-or-nodes-file]') unless %w[add delete add-local].include?(action)"
) || abort('missing action validation')
source.sub!(
  "if action == 'delete'",
  "local_path_to_delete = nil\nif action == 'delete'"
) || abort('missing delete action')
source.sub!(
  '  providers.delete(name)',
  <<~'RUBY'.chomp
    provider = providers.delete(name)
    local_path = provider.is_a?(Hash) ? provider['path'].to_s : ''
    local_path_to_delete = local_path if local_path.start_with?('/etc/openclash/proxy_provider/myboard/')
  RUBY
) || abort('missing provider delete block')

replacement = <<~'RUBY'
  if action == 'add-local'
    nodes = JSON.parse(File.read(url))
    die("本地订阅节点格式错误") unless nodes.is_a?(Array) && !nodes.empty? && nodes.all? { |node| node.is_a?(Hash) && node['name'] && node['type'] }
    provider_path = "/etc/openclash/proxy_provider/myboard/#{slug}.yaml"
    provider_dir = File.dirname(provider_path)
    Dir.mkdir(provider_dir) unless Dir.exist?(provider_dir)
    File.write(provider_path, YAML.dump('proxies' => nodes))
  providers[name] = {
    'type' => 'file',
    'path' => provider_path,
    'health-check' => { 'enable' => true, 'interval' => 3600, 'url' => 'http://www.gstatic.com/generate_204' },
  }
  else
    providers[name] = {
      'type' => 'http',
      'url' => url.strip,
      'interval' => 86400,
      'path' => "./proxy_provider/#{slug}.yaml",
      'health-check' => { 'enable' => true, 'interval' => 3600, 'url' => 'http://www.gstatic.com/generate_204' },
    }
  end
  RUBY

pattern = /  providers\[name\] = \{\n.*?\n  \}/m
source.sub!(pattern, replacement) || abort('missing provider creation block')
success_line = 'puts "OK: providers=#{providers.keys.join(\',\')} backup=#{bak}"'
source.sub!("# 备份", "#{provider_group_sync}\n# 备份") || abort('missing config backup marker')
source.sub!(
  success_line,
  "File.delete(local_path_to_delete) if local_path_to_delete && File.file?(local_path_to_delete)\n#{success_line}"
) || abort('missing success output block')

backup = "#{target}.before-local-provider"
File.write(backup, File.read(target))
File.write(target, source)
puts "patched #{target}; backup: #{backup}"
