from pydantic import BaseModel


class ActivityBase(BaseModel):
    activity_type: str
    description: str


class ActivityCreate(ActivityBase):
    pass


class Activity(ActivityBase):
    id: int
    user_id: int
    timestamp: str

    class Config:
        from_attributes = True
