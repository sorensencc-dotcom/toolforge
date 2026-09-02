# codex_loader.py
import yaml

def load_module(path):
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

if __name__ == '__main__':
    m = load_module('post_seal_ops.yaml')
    print('module loaded:', m['module']['id'])
