import os
import re
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("ERRO: Este script requer a biblioteca Pillow.")
    print("Por favor, instale usando: pip install pillow")
    sys.exit(1)

# Configurações de Caminho
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
ASSETS_DIR = os.path.join(PUBLIC_DIR, 'assets')

# Mapeamento de Pastas
DIRS = {
    'cards': os.path.join(ASSETS_DIR, 'cards'),
    'audio': os.path.join(ASSETS_DIR, 'audio') # Cria a pasta de áudio também
}

def ensure_directories():
    """Cria a estrutura de pastas se não existir."""
    for path in DIRS.values():
        if not os.path.exists(path):
            os.makedirs(path)
            print(f"Diretório criado: {path}")

def generate_placeholder(category, filename, color, size=(400, 600)):
    """Gera uma imagem placeholder simples com texto."""
    folder = DIRS[category]
    filepath = os.path.join(folder, filename)
    
    # Se já existe, pula (para não sobrescrever artes reais que você já tenha colocado)
    if os.path.exists(filepath):
        print(f"Ignorado (já existe): {category}/{filename}")
        return

    try:
        # Cria imagem com cor sólida
        img = Image.new('RGB', size, color=color)
        draw = ImageDraw.Draw(img)
        
        # Desenha uma borda
        draw.rectangle([(0,0), (size[0]-1, size[1]-1)], outline=(255,255,255), width=5)
        
        # Tenta desenhar o texto (nome do arquivo)
        text = filename
        # Usa fonte padrão do sistema
        font = ImageFont.load_default()
        
        # Posiciona o texto (simples)
        draw.text((20, size[1] // 2), text, fill=(255, 255, 255), font=font)

        img.save(filepath)
        print(f"Gerado: {category}/{filename}")
    except Exception as e:
        print(f"Erro ao gerar {filename}: {e}")

def generate_dummy_audio(filename):
    """Gera um arquivo de áudio vazio para evitar erro 404."""
    folder = DIRS['audio']
    filepath = os.path.join(folder, filename)
    
    if os.path.exists(filepath):
        print(f"Ignorado (já existe): audio/{filename}")
        return

    # Cria um arquivo vazio
    with open(filepath, 'wb') as f:
        f.write(b'') 
    print(f"Gerado (Áudio Mudo): audio/{filename}")

def scan_and_generate():
    # 1. Ler server.js para Cartas de Tarô
    server_path = os.path.join(BASE_DIR, 'server.js')
    if os.path.exists(server_path):
        with open(server_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Regex para encontrar image: 'nome.png'
            matches = re.findall(r"image:\s*['\"](.+?)['\"]", content)
            for m in matches:
                # Cartas de Tarô (Vermelho Escuro)
                generate_placeholder('cards', m, (80, 20, 20), size=(300, 500))

    # 2. Ler client.js para Efeitos Sonoros
    # Tenta achar o client.js na raiz ou na pasta public
    client_path = os.path.join(BASE_DIR, 'client.js')
    if not os.path.exists(client_path):
        client_path = os.path.join(PUBLIC_DIR, 'client.js')

    if os.path.exists(client_path):
        with open(client_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Regex para encontrar: new Audio('assets/audio/nome.mp3')
            audio_matches = re.findall(r"new Audio\(['\"]assets/audio/(.+?)['\"]\)", content)
            for m in audio_matches:
                generate_dummy_audio(m.strip())

def main():
    print("--- Gerador de Assets Placeholder ---")
    ensure_directories()
    scan_and_generate()
    print("\nConcluído! Verifique a pasta public/assets.")

if __name__ == "__main__":
    main()