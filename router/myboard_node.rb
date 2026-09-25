#!/usr/bin/env ruby
require 'yaml'
require 'json'

def detect_config
  return ENV['MYBOARD_CONFIG'] unless ENV['MYBOARD_CONFIG'].to_s.empty?

  ps = `ps w 2>/dev/null`.lines.grep(/clash -d .* -f (\S+)/) { $1 }
  return ps.first.strip if ps.first && File.exist?(ps.first.strip)

  Dir['/etc/openclash/*.yaml'].reject { |file| file.include?('template') }
    .max_by { |file| File.mtime(file) rescue 0 } || '/etc/openclash/config.yaml'
end

CONFIG = detect_config
API = ENV['MYBOARD_API'] || 'http://127.0.0.1:9090'
RELOAD = ENV['MYBOARD_RELOAD'].to_s != '0'

action = ARGV[0].to_s
name = ARGV[1].to_s
json_path = ARGV[2].to_s

def die(message)
  puts "ERR: #{message}"
  exit 2
end

die('usage: get|add|update|delete name [node.json]') unless %w[get add update delete].include?(action)

data = YAML.load_file(CONFIG, aliases: true)
die('配置不是 Hash') unless data.is_a?(Hash)
secret = ENV['MYBOARD_SECRET'].to_s
secret = data['secret'].to_s if secret.empty?
die('未配置控制器密钥') if secret.empty?

nodes = data['proxies'] ||= []
die('proxies 不是数组') unless nodes.is_a?(Array)
groups = data['proxy-groups'] ||= []
die('proxy-groups 不是数组') unless groups.is_a?(Array)

# Keep custom nodes in every hidden per-policy manual selector.
manual_prefix = '__myboard_manual__::'
sync_manual_custom_nodes = lambda do
  custom_names = nodes.filter_map { |item| item['name'] if item.is_a?(Hash) && !item['name'].to_s.empty? }
  groups.each do |group|
    next unless group.is_a?(Hash) && group['name'].to_s.start_with?(manual_prefix)

    group['proxies'] = custom_names.dup
  end
end

BUCKETS = [
  ['香港', /香港|\bhk\b|hong\s*kong/i],
  ['台湾', /台湾|\btw\b|taiwan/i],
  ['日本', /日本|\bjp\b|\bjpn\b|japan/i],
  ['新加坡', /新加坡|\bsg\b|\bsgp\b|singapore/i],
  ['马来西亚', /马来西亚|malaysia|\bmy\b|\bmys\b/i],
  ['美国', /美国|\bus\b|\busa\b|united\s*states|america|凤凰城|phoenix/i],
  ['韩国', /韩国|\bkr\b|\bkor\b|korea/i],
  ['德国', /德国|\bde\b|germany/i],
  ['英国', /英国|\buk\b|\bgb\b|britain|united\s*kingdom/i],
  ['荷兰', /荷兰|\bnl\b|netherlands/i],
  ['芬兰', /芬兰|\bfi\b|finland/i],
]

def groups_for_node(groups, name)
  bucket = BUCKETS.find { |_, pattern| pattern.match?(name.to_s) }&.first
  return [] unless bucket

  exact = groups.select { |group| group.is_a?(Hash) && group['name'].to_s.strip == bucket }
  return exact unless exact.empty?

  groups.select do |group|
    group.is_a?(Hash) && group['name'].to_s.match?(/#{Regexp.escape(bucket)}/i)
  end
end

def add_node_to_matching_groups(groups, name)
  assigned = []
  groups_for_node(groups, name).each do |group|
    group['proxies'] ||= []
    next unless group['proxies'].is_a?(Array)
    next if group['proxies'].include?(name)

    group['proxies'] << name
    assigned << group['name']
  end
  assigned
end

def replace_node_in_groups(groups, old_name, new_name)
  groups.each do |group|
    next unless group.is_a?(Hash) && group['proxies'].is_a?(Array)

    group['proxies'].map! { |item| item == old_name ? new_name : item }
    group['proxies'] = group['proxies'].uniq
  end
end

def remove_node_from_groups(groups, name)
  groups.each do |group|
    next unless group.is_a?(Hash) && group['proxies'].is_a?(Array)

    group['proxies'].delete(name)
  end
end

if action == 'get'
  node = nodes.find { |item| item.is_a?(Hash) && item['name'] == name }
  die("未找到节点: #{name}") unless node
  memberships = groups.select do |group|
    group.is_a?(Hash) && group['proxies'].is_a?(Array) && group['proxies'].include?(name)
  end
  group_name = groups_for_node(groups, name).find do |group|
    group['proxies'].is_a?(Array) && group['proxies'].include?(name)
  end || memberships.find do |group|
    BUCKETS.any? { |bucket, _| group['name'].to_s.strip.casecmp?(bucket) }
  end&.[]('name') || memberships.first&.[]('name')
  puts JSON.generate({ ok: true, node: node, group: group_name })
  exit 0
end

if action == 'delete'
  count_before = nodes.size
  nodes.reject! { |item| item.is_a?(Hash) && item['name'] == name }
  die("未找到节点: #{name}") if nodes.size == count_before
  remove_node_from_groups(groups, name)
else
  node = JSON.parse(File.read(json_path))
  die('节点缺少 name') unless node.is_a?(Hash) && !node['name'].to_s.empty?
  selected_group = node.delete('__myboardGroupName').to_s

  if action == 'add'
    die("节点已存在: #{node['name']}") if nodes.any? { |item| item.is_a?(Hash) && item['name'] == node['name'] }
    nodes << node
    assigned_groups = if selected_group.empty?
      add_node_to_matching_groups(groups, node['name'])
    else
      target = groups.find { |group| group.is_a?(Hash) && group['name'].to_s == selected_group }
      die("未找到节点组: #{selected_group}") unless target
      target['proxies'] ||= []
      die("节点组配置无效: #{selected_group}") unless target['proxies'].is_a?(Array)
      target['proxies'] << node['name'] unless target['proxies'].include?(node['name'])
      [selected_group]
    end
  else
    index = nodes.index { |item| item.is_a?(Hash) && item['name'] == name }
    die("未找到节点: #{name}") unless index
    new_name = node['name'].to_s
    die('节点缺少 name') if new_name.empty?
    if new_name != name && nodes.any? { |item| item.is_a?(Hash) && item['name'] == new_name }
      die("节点已存在: #{new_name}")
    end
    previous_automatic_groups = groups_for_node(groups, name)
    replace_node_in_groups(groups, name, new_name)
    nodes[index] = node
    assigned_groups = if selected_group.empty?
      previous_automatic_groups.each do |group|
        group['proxies'].delete(new_name) if group['proxies'].is_a?(Array)
      end
      add_node_to_matching_groups(groups, new_name)
    else
      remove_node_from_groups(groups, new_name)
      target = groups.find { |group| group.is_a?(Hash) && group['name'].to_s == selected_group }
      die("未找到节点组: #{selected_group}") unless target
      target['proxies'] ||= []
      die("节点组配置无效: #{selected_group}") unless target['proxies'].is_a?(Array)
      target['proxies'] << new_name unless target['proxies'].include?(new_name)
      [selected_group]
    end
  end
end

sync_manual_custom_nodes.call

Dir.mkdir('/etc/openclash/mybak') unless Dir.exist?('/etc/openclash/mybak')
timestamp = Time.now.strftime('%Y%m%d%H%M%S')
backup = "/etc/openclash/mybak/#{File.basename(CONFIG)}.node.#{action}.#{timestamp}.bak"
File.write(backup, File.read(CONFIG))
File.write(CONFIG, YAML.dump(data))

if RELOAD
  payload = JSON.generate({ path: CONFIG })
  cmd = "curl -s -k -m 30 -X PUT '#{API}/configs' -H 'Authorization: Bearer #{secret}' -H 'Content-Type: application/json' -d '#{payload}'"
  reload = `#{cmd} 2>&1`
  if reload.include?('"error"') || reload.include?('"message"')
    File.write(CONFIG, File.read(backup))
    puts "ERR: 重载失败，已回滚: #{reload.strip[0, 200]}"
    exit 1
  end
end

puts "OK: backup=#{backup} assigned_groups=#{Array(assigned_groups).join(',')}"
