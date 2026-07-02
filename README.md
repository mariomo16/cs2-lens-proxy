# CS2 Lens Proxy

Proxy API for FACEIT endpoints, deployed on Vercel.

## Endpoints

### Retrieve player details

```
GET /api/faceit/players
```

**Query Parameters**  
_Appended to the end of the URL (e.g., ?game=cs2)._

| Parameter        | Type   | Required    | Description                           |
| ---------------- | ------ | ----------- | ------------------------------------- |
| `nickname`       | string | Conditional | The nickname of the player on FACEIT  |
| `game`           | string | Conditional | A game on FACEIT                      |
| `game_player_id` | string | Conditional | The ID of a player on game's platform |

> [!WARNING]
> Validation Rules (Mutually Exclusive Groups):
>
> - **Group 1:** `nickname` (If provided, `game_player_id` and `game` must be omitted).
> - **Group 2:** `game_player_id` + `game` (Both are strictly required if `nickname` is omitted).

[Source](https://docs.faceit.com/docs/data-api/data#tag/Players/operation/getPlayerFromLookup)

### Retrieve player details

```
GET /api/faceit/players/{player_id}
```

**Path Parameters**  
_Embedded directly within the URL path._

| Parameter   | Type   | Required | Description          |
| ----------- | ------ | -------- | -------------------- |
| `player_id` | string | Yes      | The id of the player |

[Source](https://docs.faceit.com/docs/data-api/data#tag/Players/operation/getPlayer)

### Retrieve global ranking of a game

```
GET /api/faceit/rankings/games/{game_id}/regions/{region}
```

**Path Parameters**  
_Embedded directly within the URL path._

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| `game_id` | string | Yes      | The id of the game |
| `region`  | string | Yes      | A region of a game |

**Query Parameters**  
_Appended to the end of the URL (e.g., ?country=es)._

| Parameter | Type             | Required | Description                   |
| --------- | ---------------- | -------- | ----------------------------- |
| `country` | string           | No       | A country code (ISO 3166-1)   |
| `offset`  | integer >=0      | No       | The starting item position    |
| `limit`   | integer [1..100] | No       | The number of items to return |

[Source](https://docs.faceit.com/docs/data-api/data#tag/Rankings/operation/getGlobalRanking)

### Retrieve user position in the global ranking of a game

```
GET /api/faceit/rankings/games/{game_id}/regions/{region}/players/{player_id}
```

**Path Parameters**  
_Embedded directly within the URL path._

| Parameter   | Type   | Required | Description          |
| ----------- | ------ | -------- | -------------------- |
| `game_id`   | string | Yes      | The id of the game   |
| `region`    | string | Yes      | A region of a game   |
| `player_id` | string | Yes      | The id of the player |

**Query Parameters**  
_Appended to the end of the URL (e.g., ?country=es)._

| Parameter | Type             | Required | Description                   |
| --------- | ---------------- | -------- | ----------------------------- |
| `country` | string           | No       | A country code (ISO 3166-1)   |
| `limit`   | integer [1..100] | No       | The number of items to return |

[Source](https://docs.faceit.com/docs/data-api/data#tag/Rankings/operation/getPlayerRanking)

## Environment variables

| Variable         | Description    |
| ---------------- | -------------- |
| `FACEIT_API_KEY` | FACEIT API key |

## Local development

```bash
vercel dev
```
