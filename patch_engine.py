import re

with open('d:/Bin/Projects/TWK/Back/simulation/engine.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Part 1
target1 = """            # Варианты: остаться на месте, шагнуть на свободную клетку или напасть на соседа
            options = [(agent.x, agent.y)] + free_neighbors
            if agent.aggression >= 0.25 or agent.carnivore >= 0.3:
                options += occupied_neighbors

            best_score = float("-inf")
            best_pos = (agent.x, agent.y)"""

replacement1 = """            # Варианты: остаться на месте, шагнуть на свободную клетку или напасть на соседа
            options = [(agent.x, agent.y)] + free_neighbors
            if agent.aggression >= 0.25 or agent.carnivore >= 0.3:
                options += occupied_neighbors

            target_prey_pos = None
            if agent.caste == "predator" or agent.carnivore >= 0.3:
                vision_radius = 8
                best_dist = float("inf")
                for other in survivors:
                    if other.id == agent.id or not other.is_alive:
                        continue
                    if other.caste == "peaceful" or (other.energy < agent.energy - 10):
                        dx_raw = abs(agent.x - other.x)
                        dx = min(dx_raw, self.config.width - dx_raw)
                        dy = abs(agent.y - other.y)
                        dist = dx + dy
                        if dist <= vision_radius and dist < best_dist:
                            best_dist = dist
                            target_prey_pos = (other.x, other.y)

            best_score = float("-inf")
            best_pos = (agent.x, agent.y)"""

# Part 2
target2 = """                    # Территориальная привязка к кратеру
                    pos_dep = self.depressions.get(pos, 0)
                    stay_dep_bonus = 3.0 * agent.territorial if pos_dep > 0 and agent.territorial > 0 else (
                        -1.0 * abs(agent.territorial) if pos_dep == 0 and agent.territorial > 0 and (agent.x, agent.y) in self.depressions else 0.0
                    )

                    score = (
                        (agent.w_temp * pos_penalty) 
                        + (agent.w_swarm * swarm_count) 
                        - fear_penalty 
                        + stay_dep_bonus 
                        + self.rng.gauss(0, 0.5)
                    )"""

replacement2 = """                    # Территориальная привязка к кратеру
                    pos_dep = self.depressions.get(pos, 0)
                    stay_dep_bonus = 3.0 * agent.territorial if pos_dep > 0 and agent.territorial > 0 else (
                        -1.0 * abs(agent.territorial) if pos_dep == 0 and agent.territorial > 0 and (agent.x, agent.y) in self.depressions else 0.0
                    )

                    prey_bonus = 0.0
                    if target_prey_pos is not None:
                        dx_raw = abs(pos[0] - target_prey_pos[0])
                        dx = min(dx_raw, self.config.width - dx_raw)
                        dy = abs(pos[1] - target_prey_pos[1])
                        new_dist = dx + dy
                        
                        dx_raw_old = abs(agent.x - target_prey_pos[0])
                        dx_old = min(dx_raw_old, self.config.width - dx_raw_old)
                        dy_old = abs(agent.y - target_prey_pos[1])
                        old_dist = dx_old + dy_old

                        if new_dist < old_dist:
                            prey_bonus = agent.carnivore * 5.0 + max(0.0, agent.aggression) * 3.0
                        elif new_dist > old_dist:
                            prey_bonus = - (agent.carnivore * 5.0 + max(0.0, agent.aggression) * 3.0)

                    score = (
                        (agent.w_temp * pos_penalty) 
                        + (agent.w_swarm * swarm_count) 
                        - fear_penalty 
                        + stay_dep_bonus 
                        + prey_bonus
                        + self.rng.gauss(0, 0.5)
                    )"""

content = content.replace(target1, replacement1)
content = content.replace(target2, replacement2)

with open('d:/Bin/Projects/TWK/Back/simulation/engine.py', 'w', encoding='utf-8') as f:
    f.write(content)

