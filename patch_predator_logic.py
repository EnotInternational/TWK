import os

file_path = 'd:/Bin/Projects/TWK/Back/simulation/engine.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """                    combat_incentive = (
                        (agent.aggression * 3.0) 
                        + energy_diff 
                        + zone_bonus 
                        + hunger_drive 
                        + territorial_incentive 
                        - (agent.fear * target.aggression * 3.0)
                    )

                    if combat_incentive <= 0.4:
                        continue"""

replacement1 = """                    combat_incentive = (
                        (agent.aggression * 3.0) 
                        + energy_diff 
                        + zone_bonus 
                        + hunger_drive 
                        + territorial_incentive 
                        - (agent.fear * target.aggression * 3.0)
                    )

                    if agent.caste == "predator" and target.caste == "predator":
                        combat_incentive -= 4.0  # Сильно снижаем желание хищников нападать друг на друга

                    if combat_incentive <= 0.4:
                        continue"""


target2 = """                # ВАРИАНТ 2: Хищник встречает Хищника
                elif attacker.caste == "predator" and defender.caste == "predator":
                    p1_friend = attacker.friendliness / max(0.01, attacker.friendliness + attacker.ferocity)
                    p2_friend = defender.friendliness / max(0.01, defender.friendliness + defender.ferocity)

                    if self.rng.random() < p1_friend and self.rng.random() < p2_friend:"""

replacement2 = """                # ВАРИАНТ 2: Хищник встречает Хищника
                elif attacker.caste == "predator" and defender.caste == "predator":
                    # Повышенная вероятность кооперации между хищниками
                    p1_friend = (attacker.friendliness + 0.5) / max(0.01, attacker.friendliness + attacker.ferocity + 0.5)
                    p2_friend = (defender.friendliness + 0.5) / max(0.01, defender.friendliness + defender.ferocity + 0.5)

                    if self.rng.random() < p1_friend or self.rng.random() < p2_friend:"""

if target1 in content and target2 in content:
    content = content.replace(target1, replacement1)
    content = content.replace(target2, replacement2)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched successfully.")
else:
    print("Could not find target strings!")
